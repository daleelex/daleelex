import './env.js';
import { Prisma, PrismaClient } from '@prisma/client';
import type { ManagementSource } from '@daleelex/shared';
import { GitHubDocsClient } from './githubDocs.js';
import { GitHubCatalogClient } from './githubCatalog.js';
import { planCatalogSync } from './catalogSync.js';
import { GitHubRepositoryClient } from './githubRepositories.js';
import { checks } from './checks/index.js';
import { changedResults, runChecks, type StoredResult } from './scorecard.js';
import { parseIntervalMinutes } from './schedule.js';

let prisma: PrismaClient | undefined;

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...fields }));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const intervalMinutes = parseIntervalMinutes(process.env.INGEST_INTERVAL_MINUTES);
  const dryRun = process.argv.includes('--dry-run');

  if (!databaseUrl) {
    log('ingestor.skipped', { message: 'Set DATABASE_URL to enable the ingestor.' });
    // A scheduled worker with nothing to connect to is misconfigured. Exiting
    // cleanly would look like a healthy run to whatever supervises it.
    if (intervalMinutes !== null) process.exitCode = 1;
    return;
  }

  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const client = prisma;

  if (intervalMinutes === null || dryRun) {
    if ((await runOnce(client, dryRun)) > 0) process.exitCode = 1;
    return;
  }

  // Scheduled mode: stay up and repeat. A supervisor's stop signal has to cut
  // the wait short, or a deploy would hang until the next run was due.
  let stopping = false;
  let wake: (() => void) | undefined;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      stopping = true;
      wake?.();
    });
  }

  log('ingestor.scheduled', { intervalMinutes });
  while (!stopping) {
    try {
      const failures = await runOnce(client, false);
      log('ingestor.run-completed', { failures });
    } catch (error) {
      // One bad run (database restarting, GitHub down) must not end the
      // schedule; the next run is the retry.
      log('ingestor.run-failed', { message: errorMessage(error) });
    }
    if (stopping) break;

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, intervalMinutes * 60_000);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
  log('ingestor.stopped');
}

/** One full pass: catalogue, documentation, scorecards. Returns the failure count. */
async function runOnce(client: PrismaClient, dryRun: boolean) {
  const githubToken = process.env.GITHUB_TOKEN;
  const apiUrl = process.env.GITHUB_API_URL;

  const org = process.env.GITHUB_ORG;
  let failures = 0;
  if (!githubToken) {
    log('github.disabled', {
      message: 'Set GITHUB_TOKEN to sync the catalogue and documentation from repositories.',
    });
  } else if (org) {
    failures += await syncCatalog(
      client,
      new GitHubCatalogClient(githubToken, apiUrl),
      org,
      dryRun,
    );
  } else {
    log('catalog.disabled', {
      message: 'Set GITHUB_ORG to ingest catalog-info.yaml files from an organisation.',
    });
  }

  if (dryRun) {
    log('techdocs.skipped', { message: 'Dry run; documentation sync not attempted.' });
    log('scorecard.skipped', { message: 'Dry run; checks not run.' });
    return failures;
  }

  if (githubToken) {
    failures += await syncTechDocs(client, new GitHubDocsClient(githubToken, apiUrl));
  }
  // Last, so checks see the catalogue this run just wrote. Most checks read
  // only the catalogue, so they run without a token too; the ones that need
  // GitHub skip themselves.
  failures += await syncScorecards(
    client,
    githubToken ? new GitHubRepositoryClient(githubToken, apiUrl) : null,
  );
  return failures;
}

/**
 * Reads every catalog-info.yaml in the organisation and writes the services it
 * declares. The repositories are the source of truth here: a service only
 * reaches the catalogue because some repo claims it.
 */
async function syncCatalog(
  client: PrismaClient,
  github: GitHubCatalogClient,
  org: string,
  dryRun: boolean,
) {
  // Same escape hatch as DOCS_SYNC_REF: normally the default branch, but a
  // branch can be named while testing a change to the contract.
  const ref = process.env.CATALOG_SYNC_REF;
  const repositories = await github.listRepositories(org);
  const files = [];
  let failed = 0;

  for (const repository of repositories) {
    try {
      const file = await github.fetchCatalogFile(repository, ref);
      if (file) files.push(file);
    } catch (error) {
      failed += 1;
      log('catalog.failed', { repository, message: errorMessage(error) });
    }
  }

  const [teams, existing] = await Promise.all([
    client.team.findMany({ select: { id: true } }),
    client.service.findMany({ select: { id: true, managementSource: true } }),
  ]);

  const plan = planCatalogSync({
    files,
    knownTeamIds: new Set(teams.map((team) => team.id)),
    existing: new Map(
      existing.map((service) => [service.id, service.managementSource as ManagementSource]),
    ),
  });

  for (const { repository, messages } of plan.warnings) {
    for (const message of messages) log('catalog.warning', { repository, message });
  }
  // A malformed file is that team's problem to fix — it must not stop the rest
  // of the catalogue from syncing, so these are reported, not counted as failures.
  for (const { repository, reasons } of plan.skipped) {
    log('catalog.skipped', { repository, reasons });
  }

  for (const { service, links, dependencies } of plan.upserts) {
    if (dryRun) {
      log('catalog.would-sync', {
        serviceId: service.id,
        repository: service.repository,
        name: service.name,
        ownerTeamId: service.ownerTeamId,
        links: links.length,
        dependencies,
      });
      continue;
    }

    const fields = { ...service, managementSource: 'repository' as const };
    await client.service.upsert({
      where: { id: service.id },
      create: fields,
      // A repository that comes back after a removal should return to the
      // catalogue rather than stay soft-deleted.
      update: { ...fields, deletedAt: null },
    });
    log('catalog.synced', { serviceId: service.id, repository: service.repository });
  }

  // Links and dependencies go in a second pass: a dependency's target row has
  // to exist before the join row pointing at it can.
  if (!dryRun) {
    for (const { service, links, dependencies } of plan.upserts) {
      await client.$transaction([
        // Neither has a stable identity in the file, so each service's set is
        // replaced wholesale rather than diffed.
        client.link.deleteMany({ where: { serviceId: service.id } }),
        client.link.createMany({
          data: links.map((link) => ({ serviceId: service.id, ...link })),
        }),
        client.serviceDependency.deleteMany({ where: { serviceId: service.id } }),
        client.serviceDependency.createMany({
          data: dependencies.map((dependsOnId) => ({ serviceId: service.id, dependsOnId })),
        }),
      ]);
    }
  }

  log('catalog.completed', {
    dryRun,
    repositories: repositories.length,
    registered: files.length,
    synced: plan.upserts.length,
    links: plan.upserts.reduce((total, record) => total + record.links.length, 0),
    dependencies: plan.upserts.reduce((total, record) => total + record.dependencies.length, 0),
    skipped: plan.skipped.length,
    failed,
  });

  return failed;
}

async function syncTechDocs(client: PrismaClient, github: GitHubDocsClient) {
  // Not GITHUB_REF — GitHub Actions sets that to the portal repo's own ref,
  // which would silently override the default when syncing other repositories.
  const ref = process.env.DOCS_SYNC_REF ?? 'HEAD';
  const services = await client.service.findMany({
    where: { deletedAt: null, repository: { not: null } },
    select: { id: true, repository: true },
  });

  let synced = 0;
  let failed = 0;

  for (const service of services) {
    try {
      const result = await github.fetchDocs(service.repository!, ref);
      const paths = result.docs.map((doc) => doc.path);

      await client.$transaction([
        client.serviceDoc.deleteMany({
          where: {
            serviceId: service.id,
            sourceRepository: { not: null },
            ...(paths.length > 0 ? { path: { notIn: paths } } : {}),
          },
        }),
        ...result.docs.map((doc) =>
          client.serviceDoc.upsert({
            where: { serviceId_path: { serviceId: service.id, path: doc.path } },
            create: {
              serviceId: service.id,
              ...doc,
              sourceRepository: result.repository,
              sourceSha: result.sourceSha,
            },
            update: {
              title: doc.title,
              contentMd: doc.contentMd,
              sourceRepository: result.repository,
              sourceSha: result.sourceSha,
              fetchedAt: new Date(),
            },
          }),
        ),
      ]);

      synced += 1;
      console.log(
        JSON.stringify({
          event: 'techdocs.synced',
          serviceId: service.id,
          repository: result.repository,
          sourceSha: result.sourceSha,
          documents: result.docs.length,
        }),
      );
    } catch (error) {
      failed += 1;
      console.error(
        JSON.stringify({
          event: 'techdocs.failed',
          serviceId: service.id,
          repository: service.repository,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  log('techdocs.completed', { synced, failed });
  return failed;
}

/**
 * Runs the registered checks against every service in the catalogue, portal-
 * managed ones included, and records the outcomes that changed.
 */
async function syncScorecards(client: PrismaClient, github: GitHubRepositoryClient | null) {
  // The code is the source of truth for what a check is; the table only adds
  // the `enabled` switch, which is why updates leave that column alone.
  for (const { id, label, category, weight } of checks) {
    await client.scorecardCheck.upsert({
      where: { id },
      create: { id, label, category, weight },
      update: { label, category, weight },
    });
  }
  // A check deleted from the code can never report again; without this its
  // last result would count towards scores forever.
  await client.scorecardCheck.updateMany({
    where: { id: { notIn: checks.map((check) => check.id) } },
    data: { enabled: false },
  });

  const [enabled, services, latest] = await Promise.all([
    client.scorecardCheck.findMany({ where: { enabled: true }, select: { id: true } }),
    client.service.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        ownerTeamId: true,
        repository: true,
        sloTarget: true,
        sloWindow: true,
        links: { select: { type: true, url: true } },
      },
    }),
    // Same shape of query as the API uses to read scores: DISTINCT ON stays on
    // the (service_id, check_id, ran_at DESC) index.
    client.$queryRaw<StoredResult[]>`
      SELECT DISTINCT ON (service_id, check_id)
        service_id AS "serviceId",
        check_id   AS "checkId",
        status,
        message
      FROM scorecard_results
      ORDER BY service_id, check_id, ran_at DESC
    `,
  ]);

  const enabledIds = new Set(enabled.map((check) => check.id));
  const ranAt = new Date();
  const { results, errors } = await runChecks(
    checks.filter((check) => enabledIds.has(check.id)),
    services,
    github,
  );

  for (const error of errors) log('scorecard.check-failed', { ...error });

  const changed = changedResults(latest, results);
  if (changed.length > 0) {
    await client.scorecardResult.createMany({
      data: changed.map(({ serviceId, checkId, status, message, evidence }) => ({
        serviceId,
        checkId,
        status,
        message,
        evidence: evidence as Prisma.InputJsonValue | undefined,
        ranAt,
      })),
    });
  }

  log('scorecard.completed', {
    services: services.length,
    checks: enabledIds.size,
    evaluated: results.length,
    changed: changed.length,
    failed: errors.length,
  });

  return errors.length;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
