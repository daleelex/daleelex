import type { Service } from '@daleelex/shared';

export type HealthState = 'healthy' | 'watch' | 'risk';

/** The five things a catalog entry must declare for a service to count as ready. */
export type CheckId = 'slo' | 'owner' | 'runbook' | 'dashboard' | 'production';

export interface ReadinessCheck {
  id: CheckId;
  /** Column heading and short name. */
  label: string;
  /** Completes "N service(s) …" for the services that fail this check. */
  describeMissing: (count: number) => string;
}

const have = (count: number) => (count === 1 ? 'service has' : 'services have');
const are = (count: number) => (count === 1 ? 'service is' : 'services are');

export const CHECKS: ReadinessCheck[] = [
  { id: 'slo', label: 'SLO target', describeMissing: (n) => `${have(n)} no SLO target` },
  { id: 'owner', label: 'Owner', describeMissing: (n) => `${have(n)} no owner` },
  { id: 'runbook', label: 'Runbook', describeMissing: (n) => `${have(n)} no runbook` },
  { id: 'dashboard', label: 'Dashboard', describeMissing: (n) => `${have(n)} no dashboard` },
  {
    id: 'production',
    label: 'Lifecycle',
    describeMissing: (n) => `${are(n)} not in production`,
  },
];

export interface ServiceHealth {
  service: Service;
  state: HealthState;
  score: number;
  checks: Record<CheckId, boolean>;
  gaps: string[];
  hasRunbook: boolean;
  hasDashboard: boolean;
  runbookUrl: string | null;
  dashboardUrl: string | null;
}

// These describe how complete a service's catalog entry is, not whether the
// service is up — nothing here is measured from a running system.
export const STATE_LABEL: Record<HealthState, string> = {
  healthy: 'Ready',
  watch: 'Partly ready',
  risk: 'Not ready',
};

export function toServiceHealth(service: Service): ServiceHealth {
  const runbookUrl = service.links.find((l) => l.type === 'runbook')?.url ?? null;
  const dashboardUrl = service.links.find((l) => l.type === 'dashboard')?.url ?? null;
  const checks: Record<CheckId, boolean> = {
    slo: Boolean(service.sloTarget && service.sloWindow),
    owner: Boolean(service.owner),
    runbook: runbookUrl !== null,
    dashboard: dashboardUrl !== null,
    production: service.lifecycle === 'production',
  };
  const gaps: string[] = [];

  if (!checks.slo) gaps.push('No SLO defined');
  if (!checks.owner) gaps.push('No owner assigned');
  if (!checks.runbook) gaps.push('No runbook');
  if (!checks.dashboard) gaps.push('No dashboard');
  if (!checks.production) gaps.push('Not in production');

  // Weighted, so the catalog-wide average leans on what matters most.
  const score =
    (checks.slo ? 30 : 0) +
    (checks.owner ? 25 : 0) +
    (checks.runbook ? 20 : 0) +
    (checks.dashboard ? 15 : 0) +
    (checks.production ? 10 : 0);

  // The state follows the checklist directly, so it can never disagree with
  // what a reader sees in it: a "Ready" service has no failed check.
  const state: HealthState = gaps.length === 0 ? 'healthy' : gaps.length === 1 ? 'watch' : 'risk';

  return {
    service,
    state,
    score,
    checks,
    gaps,
    hasRunbook: checks.runbook,
    hasDashboard: checks.dashboard,
    runbookUrl,
    dashboardUrl,
  };
}

export function computeHealth(services: Service[]) {
  const rows = services.map(toServiceHealth).sort((a, b) => {
    if (a.state !== b.state) return stateWeight(b.state) - stateWeight(a.state);
    return a.service.tier - b.service.tier || a.service.name.localeCompare(b.service.name);
  });

  const total = services.length;
  const withSlo = services.filter((s) => s.sloTarget && s.sloWindow).length;
  const withRunbook = rows.filter((r) => r.hasRunbook).length;
  const withOwner = services.filter((s) => s.owner).length;
  const withDashboard = rows.filter((r) => r.hasDashboard).length;
  const withProduction = services.filter((s) => s.lifecycle === 'production').length;
  const tier1 = rows.filter((r) => r.service.tier === 1);
  const tier1Ready = tier1.filter((r) => r.state === 'healthy').length;
  const healthyServices = rows.filter((r) => r.state === 'healthy').length;
  const readinessScore =
    total > 0 ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / total) : 0;

  // Failing checks, most widespread first — this is the page's to-do list.
  const checkSummary = CHECKS.map((check) => ({
    check,
    missing: rows.filter((r) => !r.checks[check.id]).length,
  })).sort((a, b) => b.missing - a.missing);

  return {
    total,
    rows,
    checkSummary,
    risks: rows.filter((r) => r.state !== 'healthy').slice(0, 5),
    needsAttention: rows.filter((r) => r.state !== 'healthy').slice(0, 4),
    withSlo,
    withRunbook,
    withOwner,
    withDashboard,
    withProduction,
    healthyServices,
    tier1Total: tier1.length,
    tier1Ready,
    sloCoverage: percent(withSlo, total),
    runbookCoverage: percent(withRunbook, total),
    ownerCoverage: percent(withOwner, total),
    dashboardCoverage: percent(withDashboard, total),
    productionCoverage: percent(withProduction, total),
    readinessScore,
    overallState:
      readinessScore >= 85 ? 'healthy' : readinessScore >= 65 ? 'watch' : ('risk' as HealthState),
    overallLabel:
      readinessScore >= 85 ? 'Mostly ready' : readinessScore >= 65 ? 'Some gaps' : 'Many gaps',
  };
}

export function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function stateWeight(state: HealthState) {
  return state === 'risk' ? 3 : state === 'watch' ? 2 : 1;
}
