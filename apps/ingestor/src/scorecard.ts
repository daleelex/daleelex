import type { Check, CheckResult, CheckService, RepositoryProbe } from './checks/index.js';

export interface FreshResult extends CheckResult {
  serviceId: string;
  checkId: string;
}

export interface CheckError {
  serviceId: string;
  checkId: string;
  message: string;
}

export interface StoredResult {
  serviceId: string;
  checkId: string;
  status: string;
  message: string | null;
}

/**
 * Runs every check against every service.
 *
 * A check that throws produces no result at all: the cause is usually GitHub
 * being unreachable, and recording that as a failure would turn an outage on
 * our side into a wave of red scorecards. The previous result stands until the
 * check can be run again.
 */
export async function runChecks(
  checks: readonly Check[],
  services: readonly CheckService[],
  github: RepositoryProbe | null,
): Promise<{ results: FreshResult[]; errors: CheckError[] }> {
  const results: FreshResult[] = [];
  const errors: CheckError[] = [];

  for (const service of services) {
    for (const check of checks) {
      try {
        const result = await check.run({ service, github });
        results.push({ serviceId: service.id, checkId: check.id, ...result });
      } catch (error) {
        errors.push({
          serviceId: service.id,
          checkId: check.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return { results, errors };
}

/**
 * The results worth writing: those whose outcome differs from the last one
 * stored. An hourly run over an unchanged catalogue then writes nothing, and
 * each row's timestamp says when the outcome last changed.
 */
export function changedResults(
  latest: readonly StoredResult[],
  fresh: readonly FreshResult[],
): FreshResult[] {
  const previous = new Map(latest.map((row) => [`${row.serviceId}:${row.checkId}`, row]));

  return fresh.filter((result) => {
    const before = previous.get(`${result.serviceId}:${result.checkId}`);
    return !before || before.status !== result.status || before.message !== result.message;
  });
}
