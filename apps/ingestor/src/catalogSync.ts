import type { ManagementSource } from '@daleelex/shared';
import { parseCatalogInfo, type ParsedService } from './catalogInfo.js';
import type { CatalogFile } from './githubCatalog.js';

export interface ServiceUpsert extends Omit<ParsedService, 'ownerRef'> {
  ownerTeamId: string | null;
  sourceSha: string;
}

export interface SkippedRepository {
  repository: string;
  reasons: string[];
}

export interface SyncPlan {
  upserts: ServiceUpsert[];
  skipped: SkippedRepository[];
  warnings: { repository: string; messages: string[] }[];
}

export interface PlanInput {
  files: CatalogFile[];
  /** Team ids that exist today; an owner outside this set cannot be linked. */
  knownTeamIds: ReadonlySet<string>;
  /** How each existing service is managed, so ingestion cannot hijack a portal entry. */
  existing: ReadonlyMap<string, ManagementSource>;
}

/**
 * Turns the catalog files found on GitHub into the set of writes to apply.
 *
 * Pure on purpose: every decision about what ingestion would do is testable
 * without a database, and `--dry-run` prints exactly what a real run applies.
 */
export function planCatalogSync({ files, knownTeamIds, existing }: PlanInput): SyncPlan {
  const upserts: ServiceUpsert[] = [];
  const skipped: SkippedRepository[] = [];
  const warnings: { repository: string; messages: string[] }[] = [];
  const claimedBy = new Map<string, string>();

  for (const file of [...files].sort((a, b) => a.repository.localeCompare(b.repository))) {
    const parsed = parseCatalogInfo(file.source, file.repository);
    const messages = [...parsed.warnings];

    if (!parsed.service) {
      skipped.push({ repository: file.repository, reasons: parsed.errors });
      if (messages.length > 0) warnings.push({ repository: file.repository, messages });
      continue;
    }

    const service = parsed.service;

    // Two repositories claiming one id would overwrite each other on every
    // run. First one alphabetically wins and the other is reported.
    const owner = claimedBy.get(service.id);
    if (owner) {
      skipped.push({
        repository: file.repository,
        reasons: [`Service id "${service.id}" is already claimed by ${owner}.`],
      });
      continue;
    }

    if (existing.get(service.id) === 'portal') {
      skipped.push({
        repository: file.repository,
        reasons: [
          `Service "${service.id}" is managed in the portal; remove it there before ingesting it from a repository.`,
        ],
      });
      continue;
    }

    const { ownerRef, ...fields } = service;
    let ownerTeamId: string | null = null;
    if (ownerRef && knownTeamIds.has(ownerRef)) {
      ownerTeamId = ownerRef;
    } else if (ownerRef) {
      messages.push(`Owner "${ownerRef}" is not a known team; importing without an owner.`);
    } else {
      messages.push('No owner declared; importing without an owner.');
    }

    claimedBy.set(service.id, file.repository);
    upserts.push({ ...fields, ownerTeamId, sourceSha: file.sourceSha });
    if (messages.length > 0) warnings.push({ repository: file.repository, messages });
  }

  return { upserts, skipped, warnings };
}
