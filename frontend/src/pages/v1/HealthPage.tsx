import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { computeHealth, STATE_LABEL } from '../lib/health';
import './HealthPage.css';

export function HealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });
  const jenkins = useQuery({
    queryKey: ['integrations', 'jenkins', 'health'],
    queryFn: api.jenkinsHealth,
    refetchInterval: 30000,
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
              <h2>Jenkins</h2>
              <p>Local CI integration</p>
            </div>
          </div>
          <div className="integration-card">
            {jenkins.isLoading && <div className="health-empty compact">Checking Jenkins...</div>}
            {jenkins.isError && <div className="health-empty compact">Failed to check Jenkins.</div>}
            {jenkins.data && (
              <>
                <div className="integration-status">
                  <span className={`summary-dot ${jenkins.data.status === 'ok' ? 'healthy' : jenkins.data.status === 'auth_required' ? 'watch' : 'risk'}`} />
                  <strong>{formatJenkinsStatus(jenkins.data.status)}</strong>
                </div>
                <dl>
                  <div>
                    <dt>URL</dt>
                    <dd>{jenkins.data.baseUrl ?? 'Not configured'}</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{jenkins.data.mode}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{jenkins.data.version ?? 'Unknown'}</dd>
                  </div>
                </dl>
                <p>{jenkins.data.message}</p>
              </>
            )}
          </div>

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


function formatJenkinsStatus(status: string) {
  switch (status) {
    case 'ok':
      return 'Connected';
    case 'auth_required':
      return 'Credentials needed';
    case 'not_configured':
      return 'Not configured';
    default:
      return 'Unreachable';
  }
}
