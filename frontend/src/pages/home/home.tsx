import { useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '../../types/catalog.types';
import { ServiceDrawer } from '../../components/organisms/service-drawer/service-drawer';
import { computeHealth, STATE_LABEL, type HealthState } from '../health/health.lib';
import { ServicesApi } from '../../services/services.service';
import { Route } from '../../configs/enums';
import './home.scss';

// SAMPLE DATA — not from a real activity/audit feed.
// Replace with a real events API when available.
const SAMPLE_ACTIVITY = [
  { kind: 'deploy' as const, title: 'auth-gateway', detail: 'v2.14.1', team: 'Platform Identity', ts: '2h ago' },
  { kind: 'score' as const, title: 'billing-service', detail: 'score ↑ 85', team: 'Payments', ts: '5h ago' },
  { kind: 'docs' as const, title: 'users-api', detail: 'README updated', team: 'Core Product', ts: '8h ago' },
  { kind: 'incident' as const, title: 'search-engine', detail: 'P2 resolved', team: 'Discovery', ts: '1d ago' },
  { kind: 'lifecycle' as const, title: 'legacy-importer', detail: '→ deprecated', team: 'Data Platform', ts: '2d ago' },
];

const ACTIVITY_META: Record<typeof SAMPLE_ACTIVITY[number]['kind'], { glyph: string; color: string }> = {
  deploy: { glyph: '⤴', color: 'var(--accent)' },
  score: { glyph: '✓', color: 'var(--ok)' },
  incident: { glyph: '!', color: 'var(--danger)' },
  docs: { glyph: '❏', color: 'var(--accent-2)' },
  lifecycle: { glyph: '◐', color: 'var(--warn)' },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function HomePage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Service | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({ queryKey: ['services'], queryFn: ServicesApi.getAll });
  const services = data?.data ?? [];
  const health = useMemo(() => computeHealth(services), [services]);
  const teamCount = useMemo(() => new Set(services.map((s) => s.ownerTeamId).filter(Boolean)).size, [services]);
  const productionCount = useMemo(
    () => services.filter((service) => service.lifecycle === 'production').length,
    [services],
  );
  const productionCoverage = useMemo(
    () => (services.length === 0 ? 0 : Math.round((productionCount / services.length) * 100)),
    [productionCount, services.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQ.trim()) navigate(`${Route.SERVICES}?q=${encodeURIComponent(searchQ.trim())}`);
    else navigate(Route.SERVICES);
  }

  const kpis = [
    { label: 'Total Services', value: health.total, sub: `across ${teamCount} teams`, accent: false },
    { label: 'Tier-1 Critical', value: health.tier1Total, sub: 'SLO ≥ 99.9%', accent: false },
    { label: 'In Production', value: productionCount, sub: `${productionCoverage}% of catalog`, accent: false },
    { label: 'Readiness', value: health.readinessScore, sub: 'avg scorecard', accent: true },
  ];

  const coverageBars = [
    { label: 'SLO coverage', pct: health.sloCoverage, color: 'var(--ok)' },
    { label: 'Owners assigned', pct: health.ownerCoverage, color: 'var(--ok)' },
    { label: 'In production', pct: productionCoverage, color: 'var(--accent)' },
    { label: 'Runbooks linked', pct: health.runbookCoverage, color: 'var(--warn)' },
    { label: 'Dashboards linked', pct: (health as any).dashboardCoverage ?? 0, color: 'var(--danger)' },
  ];

  return (
    <div className="home-body">
      <form className="home-search" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="home-search">Search services, docs, teams</label>
        <SearchIcon />
        <input
          ref={searchRef}
          id="home-search"
          type="search"
          placeholder="Search services, docs, teams..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
        <kbd className="kbd">⌘K</kbd>
      </form>

      <div className="home-hero">
        <div className="home-hero-glow" />
        <div className="home-hero-kicker">Developer Portal</div>
        <h1 className="home-hero-title">
          {greeting()}.<br />
          <em>Here's your platform.</em>
        </h1>
        <p className="home-hero-sub">
          Every service your company runs — who owns it, how healthy it is, and where
          its docs live. Find anything in one place and ship with confidence.
        </p>
        <div className="home-hero-actions">
          <Link to={Route.SERVICES} className="hero-btn-primary">
            Browse the catalog <ArrowRight />
          </Link>
          <Link to={Route.HEALTH} className="hero-btn-ghost">Health board</Link>
        </div>
      </div>

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
        <div className="home-col">
          <CatalogCoverage bars={coverageBars} readiness={health.readinessScore} />

          <div className="home-panel">
            <div className="home-panel-head">
              <h2 className="home-panel-title">Recent activity</h2>
              <span className="home-panel-badge">sample</span>
            </div>
            <div className="activity-feed">
              {SAMPLE_ACTIVITY.map((a, i) => {
                const meta = ACTIVITY_META[a.kind];
                return (
                  <div key={i} className="activity-row">
                    <div
                      className="activity-glyph"
                      style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 16%, transparent)` }}
                    >
                      {meta.glyph}
                    </div>
                    <div className="activity-body">
                      <div className="activity-title">
                        <span className="activity-name">{a.title}</span>
                        <span className="activity-detail">{a.detail}</span>
                      </div>
                      <div className="activity-team">{a.team}</div>
                    </div>
                    <div className="activity-ts">{a.ts}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="home-col">
          <div className="home-panel">
            <h2 className="home-panel-title">Needs attention</h2>
            {health.risks.length === 0 ? (
              <p className="home-empty-state">All services are healthy.</p>
            ) : (
              <div className="attention-list">
                {health.risks.map((row: any) => (
                  <button key={row.service.id} className="attention-item" onClick={() => setSelected(row.service)} type="button">
                    <div className="attention-info">
                      <div className="attention-name">{row.service.name}</div>
                      <div className="attention-sub">Tier {row.service.tier} · {row.gaps[0] ?? ''}</div>
                    </div>
                    <StatePill state={row.state} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="home-panel">
            <h2 className="home-panel-title">Quick links</h2>
            <div className="quick-links-grid">
              <QuickLink icon={<PlusIcon />} label="Register a service" sub="catalog-info.yaml" to={Route.SERVICES} />
              <QuickLink icon={<GridIcon />} label="Browse catalog" sub={`${health.total} services`} to={Route.SERVICES} />
              <QuickLink icon={<HeartbeatIcon />} label="Health & SLO" sub="board" to={Route.HEALTH} />
              <QuickLink icon={<DocIcon />} label="TechDocs" sub="browse pages" to={Route.DOCS} />
            </div>
          </div>
        </div>
      </div>

      <ServiceDrawer service={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/* ── Sub-components (unchanged from original) ───────────────────────────── */

function CatalogCoverage({ bars, readiness }: {
  bars: { label: string; pct: number; color: string }[];
  readiness: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t); }, []);

  return (
    <div className="home-panel">
      <div className="home-panel-head">
        <h2 className="home-panel-title">Catalog coverage</h2>
        <span className="coverage-readiness">readiness {readiness}/100</span>
      </div>
      <div className="coverage-bars">
        {bars.map((b) => (
          <div key={b.label} className="coverage-bar-row">
            <div className="coverage-bar-header">
              <span className="coverage-bar-label">{b.label}</span>
              <span className="coverage-bar-pct">{b.pct}%</span>
            </div>
            <div className="coverage-bar-track">
              <div className="coverage-bar-fill" style={{ width: mounted ? `${b.pct}%` : '0%', background: b.color }} />
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

function QuickLink({ icon, label, sub, to }: { icon: React.ReactNode; label: string; sub: string; to: string }) {
  return (
    <Link to={to} className="quick-link-btn">
      <div className="quick-link-icon">{icon}</div>
      <div className="quick-link-label">{label}</div>
      <div className="quick-link-sub">{sub}</div>
    </Link>
  );
}

/* ── Icons (unchanged from original) ────────────────────────────────────── */
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}
function ArrowRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
}
function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
}
function HeartbeatIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function DocIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}