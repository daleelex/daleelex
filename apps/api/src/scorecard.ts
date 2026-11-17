import type {
  ScorecardCategory,
  ScorecardCheckResult,
  ScorecardStatus,
  ServiceScorecardResponse,
} from '@daleelex/shared';

/**
 * Weighted share of applicable checks that pass, 0-100.
 *
 * A skipped check does not apply to the service, so it is left out of the
 * denominator instead of counting against it. Null when nothing applies.
 */
export function weightedScore(results: readonly { status: string; weight: number }[]) {
  const applicable = results.filter((result) => result.status !== 'skip');
  const total = applicable.reduce((sum, result) => sum + result.weight, 0);
  if (total === 0) return null;

  const passed = applicable.reduce(
    (sum, result) => sum + (result.status === 'pass' ? result.weight : 0),
    0,
  );
  return Math.round((passed / total) * 100);
}

/** One service's latest result for one enabled check, joined to the check. */
export interface LatestCheckRow {
  checkId: string;
  label: string;
  category: string;
  weight: number;
  status: string;
  message: string | null;
  ranAt: Date;
}

export function buildServiceScorecard(
  serviceId: string,
  rows: readonly LatestCheckRow[],
): ServiceScorecardResponse {
  const results: ScorecardCheckResult[] = [...rows]
    // Heaviest first, so what matters most is read first; id breaks ties to
    // keep the order stable between requests.
    .sort((a, b) => b.weight - a.weight || a.checkId.localeCompare(b.checkId))
    .map((row) => ({
      checkId: row.checkId,
      label: row.label,
      category: row.category as ScorecardCategory,
      weight: row.weight,
      status: row.status as ScorecardStatus,
      message: row.message,
      since: row.ranAt.toISOString(),
    }));

  return { serviceId, score: weightedScore(results), results };
}
