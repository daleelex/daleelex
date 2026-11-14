import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '@daleelex/shared';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { computeHealth, STATE_LABEL, type HealthState } from '../lib/health';
import { timeAgo } from '../lib/time';
import { api } from '../api';
import './HomePage.css';

// Enough to act on without scrolling; the Health page has the full list.
const ATTENTION_LIMIT = 5;
const RECENT_LIMIT = 5;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function HomePage() {
  const [selected, setSelected] = useState<Service | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ['services'], queryFn: api.services });
  const services = useMemo(() => data?.data ?? [], [data]);
  const health = useMemo(() => computeHealth(services), [services]);

  const teamCount = useMemo(
    () => new Set(services.map((s) => s.ownerTeamId).filter(Boolean)).size,
    [services],
  );

  const byState = useMemo(() => {
    const counts: Record<HealthState, number> = { healthy: 0, watch: 0, risk: 0 };
    for (const row of health.rows) counts[row.state] += 1;
    return counts;
  }, [health]);

  const attention = health.rows.filter((row) => row.state !== 'healthy');

  const recent = useMemo(
    () =>
      [...services].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_LIMIT),
    [services],
  );

  const coverageBars = [
    { label: 'SLO defined', pct: health.sloCoverage },
    { label: 'Owner assigned', pct: health.ownerCoverage },
    { label: 'In production', pct: health.productionCoverage },
    { label: 'Runbook linked', pct: health.runbookCoverage },
    { label: 'Dashboard linked', pct: health.dashboardCoverage },
  ];

  const summary = isLoading
    ? 'Loading the catalog…'
    : isError
      ? 'The catalog could not be loaded. Check the API.'
      : `${plural(health.total, 'service')} across ${plural(teamCount, 'team')} · ${
          attention.length === 0 ? 'nothing needs attention' : `${attention.length} need attention`
        }`;

  return (
    <>
      <div className="home-body">
        <header className="home-head">
          <div>
            <h1 className="home-title">{greeting()}.</h1>
            <p className={`home-sub${isError ? ' error' : ''}`}>{summary}</p>
          </div>
          <div className="home-head-actions">
            <Link to="/health" className="home-btn-ghost">
              Health board
            </Link>
            <Link to="/services" className="register-btn">
              Browse the catalog <ArrowRight />
            </Link>
          </div>
        </header>

        <div className="home-row home-row-top">
          <Pulse
            score={health.readinessScore}
            state={health.overallState}
            label={health.total === 0 ? 'No services yet' : health.overallLabel}
            total={health.total}
            byState={byState}
            facts={[
              { label: 'Tier 1 ready', value: `${health.tier1Ready}/${health.tier1Total}` },
              { label: 'In production', value: `${health.productionCoverage}%` },
              { label: 'Teams', value: String(teamCount) },
            ]}
          />

          <section className="home-panel">
            <div className="home-panel-head">
              <h2 className="home-panel-title">Needs attention</h2>
              {attention.length > 0 && <span className="home-panel-count">{attention.length}</span>}
            </div>
            {attention.length === 0 ? (
              <p className="home-empty-state">
                {isLoading ? 'Loading services…' : 'Nothing needs attention.'}
              </p>
            ) : (
              <>
                <div className="home-list">
                  {attention.slice(0, ATTENTION_LIMIT).map((row) => (
                    <button
                      key={row.service.id}
                      className="home-list-item"
                      onClick={() => setSelected(row.service)}
                    >
                      <span className={`state-dot ${row.state}`} aria-hidden="true" />
                      <span className="home-list-info">
                        <span className="home-list-name">{row.service.name}</span>
                        <span className="home-list-sub">
                          Tier {row.service.tier} · {row.gaps.join(' · ')}
                        </span>
                      </span>
                      <StatePill state={row.state} />
                    </button>
                  ))}
                </div>
                {attention.length > ATTENTION_LIMIT && (
                  <Link to="/health" className="home-panel-link">
                    View all {attention.length} <ArrowRight />
                  </Link>
                )}
              </>
            )}
          </section>
        </div>

        <div className="home-row home-row-bottom">
          <CatalogCoverage bars={coverageBars} />

          <section className="home-panel">
            <div className="home-panel-head">
              <h2 className="home-panel-title">Recently updated</h2>
            </div>
            {recent.length === 0 ? (
              <p className="home-empty-state">
                {isLoading ? 'Loading services…' : 'No services registered yet.'}
              </p>
            ) : (
              <div className="home-list">
                {recent.map((service) => (
                  <button
                    key={service.id}
                    className="home-list-item"
                    onClick={() => setSelected(service)}
                  >
                    <span className="home-list-info">
                      <span className="home-list-name">{service.name}</span>
                      <span className="home-list-sub">
                        {service.owner?.name ?? 'Unowned'} · {service.type} · tier {service.tier}
                      </span>
                    </span>
                    <span className="home-list-ts">{timeAgo(service.updatedAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ServiceDrawer service={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return mounted;
}

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const STATES: HealthState[] = ['healthy', 'watch', 'risk'];

function Pulse({
  score,
  state,
  label,
  total,
  byState,
  facts,
}: {
  score: number;
  state: HealthState;
  label: string;
  total: number;
  byState: Record<HealthState, number>;
  facts: { label: string; value: string }[];
}) {
  const mounted = useMounted();
  const filled = mounted ? (score / 100) * RING_LENGTH : 0;

  return (
    <section className="pulse" aria-label="Catalog readiness">
      <div className="pulse-main">
        <div className={`pulse-ring ${state}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="pulse-ring-track" cx="60" cy="60" r={RING_RADIUS} />
            <circle
              className="pulse-ring-fill"
              cx="60"
              cy="60"
              r={RING_RADIUS}
              strokeDasharray={`${filled} ${RING_LENGTH}`}
            />
          </svg>
          <div className="pulse-ring-value">
            <strong>{score}</strong>
            <span>/ 100</span>
          </div>
        </div>

        <div className="pulse-detail">
          <div className="pulse-kicker">Catalog readiness</div>
          <div className="pulse-label">{label}</div>

          <div className="pulse-split" aria-hidden="true">
            {STATES.map(
              (s) =>
                byState[s] > 0 && (
                  <span
                    key={s}
                    className={`pulse-split-seg ${s}`}
                    style={{ flexGrow: byState[s] }}
                  />
                ),
            )}
          </div>
          <ul className="pulse-legend">
            {STATES.map((s) => (
              <li key={s}>
                <span className={`state-dot ${s}`} aria-hidden="true" />
                <strong>{byState[s]}</strong> {STATE_LABEL[s].toLowerCase()}
              </li>
            ))}
            <li className="pulse-legend-total">of {total}</li>
          </ul>
        </div>
      </div>

      <dl className="pulse-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function coverageTone(pct: number): HealthState {
  return pct >= 85 ? 'healthy' : pct >= 60 ? 'watch' : 'risk';
}

function CatalogCoverage({ bars }: { bars: { label: string; pct: number }[] }) {
  const mounted = useMounted();

  return (
    <section className="home-panel">
      <div className="home-panel-head">
        <h2 className="home-panel-title">Catalog coverage</h2>
      </div>
      <div className="coverage-bars">
        {bars.map((b) => (
          <div key={b.label} className="coverage-bar-row">
            <span className="coverage-bar-label">{b.label}</span>
            <div className="coverage-bar-track">
              <div
                className={`coverage-bar-fill ${coverageTone(b.pct)}`}
                style={{ width: mounted ? `${b.pct}%` : '0%' }}
              />
            </div>
            <span className="coverage-bar-pct">{b.pct}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatePill({ state }: { state: HealthState }) {
  return <span className={`state-pill ${state}`}>{STATE_LABEL[state]}</span>;
}

function ArrowRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
