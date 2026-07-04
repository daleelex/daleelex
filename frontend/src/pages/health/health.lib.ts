import type { Service } from '../../types/catalog.types';

export type HealthState = 'healthy' | 'watch' | 'risk';

export const STATE_LABEL: Record<HealthState, string> = {
  healthy: 'Healthy',
  watch: 'Needs attention',
  risk: 'At risk',
};

export interface HealthRow {
  service: Service;
  state: HealthState;
  hasRunbook: boolean;
  hasDashboard: boolean;
  gaps: string[];
}

export interface HealthSummary {
  rows: HealthRow[];
  risks: HealthRow[];
  total: number;
  withSlo: number;
  withOwner: number;
  withRunbook: number;
  sloCoverage: number;
  ownerCoverage: number;
  runbookCoverage: number;
  tier1Total: number;
  tier1Ready: number;
  healthyServices: number;
  readinessScore: number;
  overallState: HealthState;
  overallLabel: string;
}

export function computeHealth(services: Service[]): HealthSummary {
  const rows: HealthRow[] = services.map((service) => {
    const hasRunbook = service.links.some((l) => l.type === 'runbook');
    const hasDashboard = service.links.some((l) => l.type === 'dashboard');
    const gaps: string[] = [];

    if (!service.owner) gaps.push('No owning team assigned');
    if (!service.sloTarget) gaps.push('No SLO target defined');
    if (!hasRunbook) gaps.push('No runbook linked');
    if (service.tier === 1 && !service.owner?.onCallSchedule) gaps.push('Tier 1 without on-call rotation');

    const state: HealthState = gaps.length === 0 ? 'healthy' : gaps.length <= 1 ? 'watch' : 'risk';
    return { service, state, hasRunbook, hasDashboard, gaps };
  });

  const total = rows.length;
  const withSlo = rows.filter((r) => r.service.sloTarget).length;
  const withOwner = rows.filter((r) => r.service.owner).length;
  const withRunbook = rows.filter((r) => r.hasRunbook).length;
  const tier1 = rows.filter((r) => r.service.tier === 1);
  const tier1Ready = tier1.filter((r) => r.state === 'healthy').length;
  const healthyServices = rows.filter((r) => r.state === 'healthy').length;

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const readinessScore = pct(healthyServices);
  const risks = rows.filter((r) => r.state === 'risk').slice(0, 5);

  const overallState: HealthState =
    total === 0 || readinessScore >= 80 ? 'healthy' : readinessScore >= 50 ? 'watch' : 'risk';

  return {
    rows, risks, total, withSlo, withOwner, withRunbook,
    sloCoverage: pct(withSlo), ownerCoverage: pct(withOwner), runbookCoverage: pct(withRunbook),
    tier1Total: tier1.length, tier1Ready, healthyServices, readinessScore,
    overallState,
    overallLabel: total === 0 ? 'No services yet' : `${STATE_LABEL[overallState]} · ${readinessScore}% ready`,
  };
}