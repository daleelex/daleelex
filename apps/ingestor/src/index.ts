import './env.js';
import { PrismaClient } from '@prisma/client';
import { GitHubDocsClient } from './githubDocs.js';

let prisma: PrismaClient | undefined;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!databaseUrl || !githubToken) {
    console.log(
      JSON.stringify({
        event: 'techdocs.skipped',
        message: 'Set DATABASE_URL and GITHUB_TOKEN to enable repository documentation sync.',
      }),
    );
    return;
  }

  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const client = prisma;
  const github = new GitHubDocsClient(githubToken, process.env.GITHUB_API_URL);
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

  console.log(JSON.stringify({ event: 'techdocs.completed', synced, failed }));
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
