import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '@daleelex/shared';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { computeHealth, STATE_LABEL, type HealthState } from '../lib/health';
import { api } from '../api';
import './HomePage.css';

// SAMPLE DATA — not from a real activity/audit feed.
// Replace with a real events API when available.
const SAMPLE_ACTIVITY = [
  { kind: 'deploy' as const, title: 'auth-gateway', detail: 'v2.14.1', team: 'Platform Identity', ts: '2h ago' },
  { kind: 'score'  as const, title: 'billing-service', detail: 'score ↑ 85', team: 'Payments', ts: '5h ago' },
  { kind: 'docs'   as const, title: 'users-api', detail: 'README updated', team: 'Core Product', ts: '8h ago' },
  { kind: 'incident' as const, title: 'search-engine', detail: 'P2 resolved', team: 'Discovery', ts: '1d ago' },
  { kind: 'lifecycle' as const, title: 'legacy-importer', detail: '→ deprecated', team: 'Data Platform', ts: '2d ago' },
];

const ACTIVITY_META: Record<typeof SAMPLE_ACTIVITY[number]['kind'], { glyph: string; color: string }> = {
  deploy:    { glyph: '⤴', color: 'var(--accent)' },
  score:     { glyph: '✓', color: 'var(--ok)' },
  incident:  { glyph: '!', color: 'var(--danger)' },
  docs:      { glyph: '❏', color: 'var(--accent-2)' },
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

  const { data } = useQuery({ queryKey: ['services'], queryFn: api.services });
  const services = data?.data ?? [];
  const health = useMemo(() => computeHealth(services), [services]);

  const teamCount = useMemo(() => new Set(services.map((s) => s.ownerTeamId).filter(Boolean)).size, [services]);

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
    if (searchQ.trim()) navigate(`/services?q=${encodeURIComponent(searchQ.trim())}`);
    else navigate('/services');
  }

  const kpis = [
    { label: 'Total Services',   value: health.total,            sub: `across ${teamCount} teams`,       accent: false },
    { label: 'Tier-1 Critical',  value: health.tier1Total,       sub: 'SLO ≥ 99.9%',                     accent: false },
    { label: 'In Production',    value: health.withProduction,   sub: `${health.productionCoverage}% of catalog`, accent: false },
    { label: 'Readiness',        value: health.readinessScore,   sub: 'avg scorecard',                   accent: true  },
  ];

  const coverageBars = [
    { label: 'SLO coverage',      pct: health.sloCoverage,        color: 'var(--ok)' },
    { label: 'Owners assigned',   pct: health.ownerCoverage,      color: 'var(--ok)' },
    { label: 'In production',     pct: health.productionCoverage, color: 'var(--accent)' },
    { label: 'Runbooks linked',   pct: health.runbookCoverage,    color: 'var(--warn)' },
    { label: 'Dashboards linked', pct: health.dashboardCoverage,  color: 'var(--danger)' },
  ];

  return (
    <>
      {/* Topbar */}
      <header className="topbar">
        <div className="crumb">
          <span>DaleelEx</span>
          <ChevronRight />
          <span className="current">Home</span>
        </div>
        <div className="top-right">
          <form className="search" onSubmit={handleSearch}>
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
          <button className="icon-btn" title="Notifications"><BellIcon /></button>
          <div className="avatar">MN</div>
        </div>
      </header>

      <div className="home-body">
        {/* Hero banner */}
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
            <Link to="/services" className="hero-btn-primary">
              Browse the catalog <ArrowRight />
            </Link>
            <Link to="/health" className="hero-btn-ghost">
              Health board
            </Link>
          </div>
        </div>

        {/* KPI row */}
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

        {/* Body grid */}
        <div className="home-grid">
          {/* Left column */}
          <div className="home-col">
            {/* Catalog coverage */}
            <CatalogCoverage bars={coverageBars} readiness={health.readinessScore} />

            {/* Recent activity — sample data */}
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
                        style={{
                          color: meta.color,
                          background: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
                        }}
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

          {/* Right column */}
          <div className="home-col">
            {/* Needs attention */}
            <div className="home-panel">
              <h2 className="home-panel-title">Needs attention</h2>
              {health.needsAttention.length === 0 ? (
                <p className="home-empty-state">All services are healthy.</p>
              ) : (
                <div className="attention-list">
                  {health.needsAttention.map((row) => (
                    <button
                      key={row.service.id}
                      className="attention-item"
                      onClick={() => setSelected(row.service)}
                    >
                      <div className="attention-info">
                        <div className="attention-name">{row.service.name}</div>
                        <div className="attention-sub">
                          Tier {row.service.tier} · {row.gaps[0] ?? ''}
                        </div>
                      </div>
                      <StatePill state={row.state} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="home-panel">
              <h2 className="home-panel-title">Quick links</h2>
              <div className="quick-links-grid">
                <QuickLink icon={<PlusIcon />} label="Register a service" sub="catalog-info.yaml" to="/services" />
                <QuickLink icon={<GridIcon />} label="Browse catalog" sub="12 services" to="/services" />
                <QuickLink icon={<HeartbeatIcon />} label="Health & SLO" sub="board" to="/health" />
                <QuickLink icon={<DocIcon />} label="TechDocs" sub="203 pages" to="/docs" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ServiceDrawer service={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

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

function QuickLink({ icon, label, sub, to }: { icon: React.ReactNode; label: string; sub: string; to: string }) {
  return (
    <Link to={to} className="quick-link-btn">
      <div className="quick-link-icon">{icon}</div>
      <div className="quick-link-label">{label}</div>
      <div className="quick-link-sub">{sub}</div>
    </Link>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function BellIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}
function ChevronRight() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>;
}
function ArrowRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
}
function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
}
function HeartbeatIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
}
function DocIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
