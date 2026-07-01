import type { Service } from '@daleelex/shared';

export type HealthState = 'healthy' | 'watch' | 'risk';

export interface ServiceHealth {
  service: Service;
  state: HealthState;
  score: number;
  gaps: string[];
  hasRunbook: boolean;
  hasDashboard: boolean;
}

export const STATE_LABEL: Record<HealthState, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  risk: 'At risk',
};

export function toServiceHealth(service: Service): ServiceHealth {
  const hasSlo = Boolean(service.sloTarget && service.sloWindow);
  const hasOwner = Boolean(service.owner);
  const hasRunbook = service.links.some((l) => l.type === 'runbook');
  const hasDashboard = service.links.some((l) => l.type === 'dashboard');
  const gaps: string[] = [];

  if (!hasSlo) gaps.push('No SLO defined');
  if (!hasOwner) gaps.push('No owner assigned');
  if (!hasRunbook) gaps.push('No runbook');
  if (!hasDashboard) gaps.push('No dashboard');
  if (service.lifecycle !== 'production') gaps.push('Pre-production');

  const score =
    (hasSlo ? 30 : 0) +
    (hasOwner ? 25 : 0) +
    (hasRunbook ? 20 : 0) +
    (hasDashboard ? 15 : 0) +
    (service.lifecycle === 'production' ? 10 : 0);

  return {
    service,
    state: score >= 85 ? 'healthy' : score >= 60 ? 'watch' : 'risk',
    score,
    gaps,
    hasRunbook,
    hasDashboard,
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
  const readinessScore = total > 0
    ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / total)
    : 0;

  return {
    total,
    rows,
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
    overallState: readinessScore >= 85 ? 'healthy' : readinessScore >= 65 ? 'watch' : ('risk' as HealthState),
    overallLabel: readinessScore >= 85 ? 'Catalog healthy' : readinessScore >= 65 ? 'Watch gaps' : 'Action needed',
  };
}

export function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function stateWeight(state: HealthState) {
  return state === 'risk' ? 3 : state === 'watch' ? 2 : 1;
}

// SAMPLE DATA — not from a real metrics provider.
// Replace with Prometheus/Grafana calls when a metrics backend is available.
// Deterministic per serviceId so values don't flicker between renders.
export function mockMetrics(serviceId: string) {
  const seed = [...serviceId].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
  const rand = (n: number, max: number, min = 0) => min + ((seed * (n + 1) * 6271) & 0xffff) % (max - min);

  const avail = 99.0 + rand(0, 10) / 10;           // 99.0–99.9
  const p95ms = 80 + rand(1, 300);                  // 80–380 ms
  const incidents = rand(2, 4);                     // 0–3
  const deploys = 4 + rand(3, 20);                  // 4–23

  const sparkline = Array.from({ length: 14 }, (_, i) => {
    const base = avail - 0.05;
    const jitter = rand(i + 10, 10) / 100;
    return Math.min(100, Math.max(base - 0.5, base + jitter));
  });

  return {
    availability: `${avail.toFixed(1)}%`,
    p95: `${p95ms} ms`,
    incidents,
    deploys,
    sparkline,
    availRaw: avail,
  };
}
