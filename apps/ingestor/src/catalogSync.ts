import type { ManagementSource } from '@daleelex/shared';
import { parseCatalogInfo, type ParsedLink, type ParsedService } from './catalogInfo.js';
import type { CatalogFile } from './githubCatalog.js';

export type ServiceFields = Omit<ParsedService, 'ownerRef' | 'links' | 'dependencies'> & {
  ownerTeamId: string | null;
  sourceSha: string;
};

export interface ServiceRecord {
  /** Scalar columns of the services row. */
  service: ServiceFields;
  links: ParsedLink[];
  /** Upstream ids that exist in the catalogue; unresolved ones are warned about. */
  dependencies: string[];
}

export interface SkippedRepository {
  repository: string;
  reasons: string[];
}

export interface Retirement {
  id: string;
  /** The repository the service was last read from. */
  repository: string | null;
}

export interface SyncPlan {
  upserts: ServiceRecord[];
  /** Services no repository declares any more, to be soft-deleted. */
  retirements: Retirement[];
  /** Why nothing was retired this run although something could have been; null otherwise. */
  retirementsHeld: string | null;
  skipped: SkippedRepository[];
  warnings: { repository: string; messages: string[] }[];
}

export interface PlanInput {
  files: CatalogFile[];
  /** Team ids that exist today; an owner outside this set cannot be linked. */
  knownTeamIds: ReadonlySet<string>;
  /** How each existing service is managed, so ingestion cannot hijack a portal entry. */
  existing: ReadonlyMap<string, ManagementSource>;
  /**
   * Live repository-managed services, by id, with the repository each was last
   * read from. Only these can be retired; leaving it out retires nothing.
   */
  retirable?: ReadonlyMap<string, string | null>;
  /** Repositories whose catalog file could not be read this run. */
  unreadable?: ReadonlySet<string>;
}

/**
 * Turns the catalog files found on GitHub into the set of writes to apply.
 *
 * Pure on purpose: every decision about what ingestion would do is testable
 * without a database, and `--dry-run` prints exactly what a real run applies.
 */
export function planCatalogSync({
  files,
  knownTeamIds,
  existing,
  retirable = new Map(),
  unreadable = new Set(),
}: PlanInput): SyncPlan {
  const upserts: ServiceRecord[] = [];
  const skipped: SkippedRepository[] = [];
  const messagesByRepository = new Map<string, string[]>();
  const claimedBy = new Map<string, string>();
  const declared = new Map<string, { repository: string; ids: string[] }>();

  for (const file of [...files].sort((a, b) => a.repository.localeCompare(b.repository))) {
    const parsed = parseCatalogInfo(file.source, file.repository);
    const messages = [...parsed.warnings];
    const remember = () => {
      if (messages.length > 0) messagesByRepository.set(file.repository, messages);
    };

    if (!parsed.service) {
      skipped.push({ repository: file.repository, reasons: parsed.errors });
      remember();
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
      remember();
      continue;
    }

    if (existing.get(service.id) === 'portal') {
      skipped.push({
        repository: file.repository,
        reasons: [
          `Service "${service.id}" is managed in the portal; remove it there before ingesting it from a repository.`,
        ],
      });
      remember();
      continue;
    }

    const { ownerRef, links, dependencies, ...fields } = service;
    let ownerTeamId: string | null = null;
    if (ownerRef && knownTeamIds.has(ownerRef)) {
      ownerTeamId = ownerRef;
    } else if (ownerRef) {
      messages.push(`Owner "${ownerRef}" is not a known team; importing without an owner.`);
    } else {
      messages.push('No owner declared; importing without an owner.');
    }

    claimedBy.set(service.id, file.repository);
    declared.set(service.id, { repository: file.repository, ids: dependencies });
    upserts.push({
      service: { ...fields, ownerTeamId, sourceSha: file.sourceSha },
      links,
      dependencies: [],
    });
    remember();
  }

  // Dependencies resolve in a second pass: a file may name a service that only
  // another repository later in the run brings into the catalogue.
  const known = new Set<string>([...existing.keys(), ...claimedBy.keys()]);
  for (const record of upserts) {
    const id = record.service.id;
    const { repository, ids } = declared.get(id)!;
    const messages = messagesByRepository.get(repository) ?? [];

    for (const dependency of ids) {
      if (dependency === id) {
        messages.push(`Service "${id}" lists itself as a dependency; ignoring it.`);
      } else if (known.has(dependency)) {
        record.dependencies.push(dependency);
      } else {
        messages.push(`Dependency "${dependency}" is not in the catalogue; ignoring it.`);
      }
    }

    if (messages.length > 0) messagesByRepository.set(repository, messages);
  }

  // A service nobody declared this run has had its catalog-info.yaml removed,
  // or its repository archived or deleted. But "we could not tell" must never
  // be read as "it is gone": a repository whose file failed to download or to
  // validate keeps its service until a later run can read it properly.
  const undetermined = new Set([...unreadable, ...skipped.map((entry) => entry.repository)]);
  const unclaimed = [...retirable]
    .filter(([id]) => !claimedBy.has(id))
    .map(([id, repository]) => ({ id, repository }));

  let retirements: Retirement[] = [];
  let retirementsHeld: string | null = null;
  if (unclaimed.length > 0 && files.length === 0) {
    // Every service vanishing at once is far more likely a token that lost
    // access, or the wrong organisation, than a real mass withdrawal.
    retirementsHeld = `No catalog-info.yaml was found in any repository, so ${unclaimed.length} service(s) were kept rather than retired. Check the token's access and GITHUB_ORG.`;
  } else {
    retirements = unclaimed.filter(
      ({ repository }) => !repository || !undetermined.has(repository),
    );
  }

  return {
    upserts,
    retirements,
    retirementsHeld,
    skipped,
    warnings: [...messagesByRepository].map(([repository, messages]) => ({ repository, messages })),
  };
}
