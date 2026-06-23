import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '@daleelex/shared';
import { api } from '../api';
import './HealthPage.css';

type HealthState = 'healthy' | 'watch' | 'risk';

interface ServiceHealth {
  service: Service;
  state: HealthState;
  score: number;
  gaps: string[];
  hasRunbook: boolean;
  hasDashboard: boolean;
}

const STATE_LABEL: Record<HealthState, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  risk: 'At risk',
};

export function HealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const services = data?.data ?? [];
  const health = useMemo(() => computeHealth(services), [services]);

  return (
    <>
      <header className="health-topbar">
        <div>
          <div className="health-kicker">Operations</div>
          <h1 className="health-title">Health &amp; SLO</h1>
        </div>
        <div className="health-summary-pill">
          <span className={`summary-dot ${health.overallState}`} />
          {health.overallLabel}
        </div>
      </header>

      <section className="health-hero">
        <div>
          <h2>Catalog-derived service readiness</h2>
          <p>
            Track SLO coverage, ownership, and operational links from the service catalog.
            This page reflects the metadata DaleelEx already collects.
          </p>
        </div>
        <div className="hero-meter" aria-label={`${health.readinessScore}% readiness`}>
          <div className="meter-ring" style={{ '--meter': `${health.readinessScore}%` } as React.CSSProperties}>
            <span>{health.readinessScore}</span>
          </div>
          <div>
            <strong>Readiness score</strong>
            <span>{health.healthyServices} healthy services</span>
          </div>
        </div>
      </section>

      <section className="health-stats">
        <Stat label="SLO coverage" value={`${health.sloCoverage}%`} sub={`${health.withSlo} of ${health.total} services`} />
        <Stat label="Tier 1 ready" value={`${health.tier1Ready}/${health.tier1Total}`} sub="SLO, owner, runbook" />
        <Stat label="Runbooks" value={`${health.runbookCoverage}%`} sub={`${health.withRunbook} linked`} />
        <Stat label="Owners" value={`${health.ownerCoverage}%`} sub={`${health.withOwner} assigned`} accent />
      </section>

      <section className="health-grid">
        <div className="health-panel">
          <div className="panel-head">
            <div>
              <h2>Service health</h2>
              <p>{isLoading ? 'Loading catalog signals...' : `${health.rows.length} services evaluated`}</p>
            </div>
          </div>

          {isLoading && <div className="health-empty">Loading health signals...</div>}
          {isError && <div className="health-empty">Failed to load health signals. Check the API.</div>}
          {!isLoading && !isError && (
            <div className="health-table-wrap">
              <table className="health-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Status</th>
                    <th>SLO</th>
                    <th>Owner</th>
                    <th>Ops links</th>
                  </tr>
                </thead>
                <tbody>
                  {health.rows.map((row) => (
                    <tr key={row.service.id}>
                      <td>
                        <div className="service-cell">
                          <strong>{row.service.name}</strong>
                          <span>{row.service.id} · Tier {row.service.tier}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`state-badge ${row.state}`}>{STATE_LABEL[row.state]}</span>
                      </td>
                      <td>
                        <div className="compact-cell">
                          <strong>{row.service.sloTarget ?? 'Missing'}</strong>
                          <span>{row.service.sloWindow ?? 'No window'}</span>
                        </div>
                      </td>
                      <td>{row.service.owner?.name ?? <span className="muted">Unassigned</span>}</td>
                      <td>
                        <div className="ops-links">
                          <span className={row.hasRunbook ? 'ok' : 'missing'}>Runbook</span>
                          <span className={row.hasDashboard ? 'ok' : 'missing'}>Dashboard</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="health-panel risk-panel">
          <div className="panel-head">
            <div>
              <h2>Needs attention</h2>
              <p>Highest priority gaps</p>
            </div>
          </div>
          <div className="risk-list">
            {health.risks.length === 0 && (
              <div className="health-empty compact">No catalog health gaps found.</div>
            )}
            {health.risks.map((row) => (
              <article key={row.service.id} className="risk-item">
                <div>
                  <strong>{row.service.name}</strong>
                  <span>Tier {row.service.tier} · {row.service.owner?.name ?? 'No owner'}</span>
                </div>
                <ul>
                  {row.gaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </>
  );
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <article className={`health-stat${accent ? ' accent' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}

function computeHealth(services: Service[]) {
  const rows = services.map(toServiceHealth).sort((a, b) => {
    if (a.state !== b.state) {
      return stateWeight(b.state) - stateWeight(a.state);
    }
    return a.service.tier - b.service.tier || a.service.name.localeCompare(b.service.name);
  });

  const total = services.length;
  const withSlo = services.filter((service) => service.sloTarget && service.sloWindow).length;
  const withRunbook = rows.filter((row) => row.hasRunbook).length;
  const withOwner = services.filter((service) => service.owner).length;
  const tier1 = rows.filter((row) => row.service.tier === 1);
  const tier1Ready = tier1.filter((row) => row.state === 'healthy').length;
  const healthyServices = rows.filter((row) => row.state === 'healthy').length;
  const readinessScore = total > 0
    ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / total)
    : 0;

  return {
    total,
    rows,
    risks: rows.filter((row) => row.state !== 'healthy').slice(0, 5),
    withSlo,
    withRunbook,
    withOwner,
    healthyServices,
    tier1Total: tier1.length,
    tier1Ready,
    sloCoverage: percent(withSlo, total),
    runbookCoverage: percent(withRunbook, total),
    ownerCoverage: percent(withOwner, total),
    readinessScore,
    overallState: readinessScore >= 85 ? 'healthy' : readinessScore >= 65 ? 'watch' : 'risk',
    overallLabel: readinessScore >= 85 ? 'Catalog healthy' : readinessScore >= 65 ? 'Watch gaps' : 'Action needed',
  };
}

function toServiceHealth(service: Service): ServiceHealth {
  const hasSlo = Boolean(service.sloTarget && service.sloWindow);
  const hasOwner = Boolean(service.owner);
  const hasRunbook = service.links.some((link) => link.type === 'runbook');
  const hasDashboard = service.links.some((link) => link.type === 'dashboard');
  const gaps: string[] = [];

  if (!hasSlo) gaps.push('Missing SLO target or window');
  if (!hasOwner) gaps.push('Missing owner');
  if (!hasRunbook) gaps.push('Missing runbook');
  if (service.tier === 1 && !hasDashboard) gaps.push('Tier 1 missing dashboard');
  if (service.lifecycle !== 'production') gaps.push(`Lifecycle is ${service.lifecycle}`);

  const score = [
    hasSlo ? 30 : 0,
    hasOwner ? 25 : 0,
    hasRunbook ? 20 : 0,
    hasDashboard ? 15 : 0,
    service.lifecycle === 'production' ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);

  return {
    service,
    state: score >= 85 ? 'healthy' : score >= 60 ? 'watch' : 'risk',
    score,
    gaps,
    hasRunbook,
    hasDashboard,
  };
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function stateWeight(state: HealthState) {
  return state === 'risk' ? 3 : state === 'watch' ? 2 : 1;
}
