import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '@daleelex/shared';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { computeHealth, STATE_LABEL, type HealthState } from '../lib/health';
import { api } from '../api';
import './HomePage.css';

// Enough to act on without scrolling; the Health page has the full list.
const ATTENTION_LIMIT = 6;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function HomePage() {
  const [selected, setSelected] = useState<Service | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['services'], queryFn: api.services });
  const services = data?.data ?? [];
  const health = useMemo(() => computeHealth(services), [services]);

  const teamCount = useMemo(
    () => new Set(services.map((s) => s.ownerTeamId).filter(Boolean)).size,
    [services],
  );

  const attention = health.rows.filter((row) => row.state !== 'healthy');

  const kpis = [
    {
      label: 'Services',
      value: health.total,
      sub: `across ${teamCount} ${teamCount === 1 ? 'team' : 'teams'}`,
      accent: false,
    },
    {
      label: 'Tier 1',
      value: health.tier1Total,
      sub: `${health.tier1Ready} fully described`,
      accent: false,
    },
    {
      label: 'In production',
      value: health.withProduction,
      sub: `${health.productionCoverage}% of catalog`,
      accent: false,
    },
    { label: 'Readiness', value: health.readinessScore, sub: 'out of 100', accent: true },
  ];

  const coverageBars = [
    { label: 'SLO coverage', pct: health.sloCoverage, color: 'var(--ok)' },
    { label: 'Owners assigned', pct: health.ownerCoverage, color: 'var(--ok)' },
    { label: 'In production', pct: health.productionCoverage, color: 'var(--accent)' },
    { label: 'Runbooks linked', pct: health.runbookCoverage, color: 'var(--warn)' },
    { label: 'Dashboards linked', pct: health.dashboardCoverage, color: 'var(--danger)' },
  ];

  return (
    <>
      <div className="home-body">
        <header className="home-head">
          <h1 className="home-title">{greeting()}.</h1>
          {!isLoading && (
            <p className="home-sub">
              {attention.length === 0
                ? 'Every service in the catalog is fully described.'
                : `${attention.length} of ${health.total} services need attention.`}
            </p>
          )}
        </header>

        <div className="home-kpi-row">
          {kpis.map((k) => (
            <div key={k.label} className={`stat-cell${k.accent ? ' accent' : ''}`}>
              <div className="stat-label">{k.label}</div>
              <div className="stat-inner">
                <div className="stat-value">{k.value}</div>
              </div>
              <div className="stat-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="home-grid">
          <div className="home-panel">
            <div className="home-panel-head">
              <h2 className="home-panel-title">Needs attention</h2>
              {attention.length > ATTENTION_LIMIT && (
                <Link to="/health" className="home-panel-link">
                  View all {attention.length}
                </Link>
              )}
            </div>
            {attention.length === 0 ? (
              <p className="home-empty-state">
                {isLoading ? 'Loading services…' : 'Nothing needs attention.'}
              </p>
            ) : (
              <div className="attention-list">
                {attention.slice(0, ATTENTION_LIMIT).map((row) => (
                  <button
                    key={row.service.id}
                    className="attention-item"
                    onClick={() => setSelected(row.service)}
                  >
                    <div className="attention-info">
                      <div className="attention-name">{row.service.name}</div>
                      <div className="attention-sub">
                        Tier {row.service.tier} · {row.gaps.join(' · ')}
                      </div>
                    </div>
                    <StatePill state={row.state} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <CatalogCoverage bars={coverageBars} />
        </div>
      </div>

      <ServiceDrawer service={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function CatalogCoverage({ bars }: { bars: { label: string; pct: number; color: string }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div className="home-panel">
      <h2 className="home-panel-title">Catalog coverage</h2>
      <div className="coverage-bars">
        {bars.map((b) => (
          <div key={b.label} className="coverage-bar-row">
            <div className="coverage-bar-header">
              <span className="coverage-bar-label">{b.label}</span>
              <span className="coverage-bar-pct">{b.pct}%</span>
            </div>
            <div className="coverage-bar-track">
              <div
                className="coverage-bar-fill"
                style={{
                  width: mounted ? `${b.pct}%` : '0%',
                  background: b.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatePill({ state }: { state: HealthState }) {
  return <span className={`state-pill ${state}`}>{STATE_LABEL[state]}</span>;
}
