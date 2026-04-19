import { useState, useEffect } from 'react';
import type { Service, ServiceLink } from '@daleelex/shared';
import './ServiceDrawer.css';

type Tab = 'overview' | 'scorecard' | 'dependencies' | 'docs';
const TABS: Tab[] = ['overview', 'scorecard', 'dependencies', 'docs'];

const LIFECYCLE_COLOR: Record<string, string> = {
  production: 'var(--ok)',
  beta: 'var(--warn)',
  deprecated: 'var(--muted)',
};

interface Props {
  service: Service | null;
  onClose: () => void;
}

function deriveChecks(service: Service) {
  return [
    { label: 'README present', pass: true },
    { label: 'Owner assigned', pass: service.owner !== null },
    { label: 'On-call rotation configured', pass: !!service.owner?.onCallSchedule },
    { label: 'SLO defined', pass: !!service.sloTarget },
    { label: 'Runbook linked', pass: service.links.some((l) => l.type === 'runbook') },
    { label: 'Vulnerability scan clean (7d)', pass: true },
    { label: 'Tracing instrumented', pass: false },
    { label: 'Chaos test passed (30d)', pass: false },
  ];
}

export function ServiceDrawer({ service, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => { setTab('overview'); }, [service?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!service) return null;

  const checks = deriveChecks(service);
  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={service.name}>
        <div className="drawer-head">
          <button className="drawer-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
          <div style={{ flex: 1 }} />
          <button className="ghost-btn">
            <StarIcon /> Watch
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-top-row">
            <span className={`tier-badge tier-${service.tier}`}>T{service.tier}</span>
            <div className="drawer-lifecycle">
              <CircleDot color={LIFECYCLE_COLOR[service.lifecycle] ?? 'var(--muted)'} />
              <span>{service.lifecycle}</span>
            </div>
          </div>

          <h2 className="drawer-title">{service.name}</h2>
          <div className="drawer-id">{service.id}</div>
          {service.description && <p className="drawer-desc">{service.description}</p>}

          <div className="tabs">
            {TABS.map((t) => (
              <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {tab === 'overview' && <OverviewTab service={service} />}
            {tab === 'scorecard' && <ScorecardTab checks={checks} passed={passed} score={score} />}
            {tab === 'dependencies' && <DependenciesTab />}
            {tab === 'docs' && <DocsTab links={service.links} />}
          </div>
        </div>
      </aside>
    </>
  );
}

function OverviewTab({ service }: { service: Service }) {
  return (
    <>
      <div className="kv-grid">
        <div className="kv">
          <div className="meta-label">Owner team</div>
          <div className="meta-value">{service.owner?.name ?? '—'}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Language</div>
          <div className="meta-value">{service.language ?? '—'}</div>
        </div>
        <div className="kv">
          <div className="meta-label">SLO target</div>
          <div className="meta-value">{service.sloTarget ?? '—'}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Tier</div>
          <div className="meta-value">Tier {service.tier}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Lifecycle</div>
          <div className="meta-value">{service.lifecycle}</div>
        </div>
        <div className="kv">
          <div className="meta-label">Repository</div>
          <div className="meta-value mono">{service.repository ?? '—'}</div>
        </div>
      </div>

      <h4 className="section-title">Health signals · 30 days</h4>
      <div className="signal-row">
        {[
          { label: 'Availability', value: '99.8%', color: 'var(--ok)' },
          { label: 'Incidents', value: '0', color: 'var(--ok)' },
          { label: 'Deploys', value: '12', color: 'var(--accent)' },
          { label: 'p95 latency', value: '184 ms', color: 'var(--ok)' },
        ].map((s) => (
          <div key={s.label} className="signal-cell">
            <div className="meta-label">{s.label}</div>
            <div className="signal-value">{s.value}</div>
            <div className="signal-bar" style={{ background: s.color }} />
          </div>
        ))}
      </div>

      {service.tags.length > 0 && (
        <>
          <h4 className="section-title">Tags</h4>
          <div>
            {service.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ScorecardTab({ checks, passed, score }: { checks: ReturnType<typeof deriveChecks>; passed: number; score: number }) {
  return (
    <>
      <div className="score-hero">
        <div className="ring-wrap">
          <Ring score={score} />
          <span className="ring-pct">{score}%</span>
        </div>
        <div>
          <div className="score-hero-label">Production readiness</div>
          <div className="score-hero-main">{passed} / {checks.length} checks passing</div>
          <div className="score-hero-sub">Last evaluated 2 hours ago · Policy <code>standard-v3</code></div>
        </div>
      </div>

      <h4 className="section-title">Checks</h4>
      <div>
        {checks.map((c) => (
          <div key={c.label} className={`check-row${c.pass ? ' pass' : ' fail'}`}>
            {c.pass ? <CheckIcon /> : <AlertIcon />}
            <span className="check-label">{c.label}</span>
            <span className={`check-status${c.pass ? ' pass' : ' fail'}`}>
              {c.pass ? 'pass' : 'action needed'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function DependenciesTab() {
  return (
    <div className="dep-empty">
      <DepIcon />
      <p>Dependency mapping coming soon.</p>
      <p className="dep-empty-sub">
        Add a <code>dependencies</code> field to your <code>catalog-info.yaml</code> to see upstream and downstream services here.
      </p>
    </div>
  );
}

function DocsTab({ links }: { links: ServiceLink[] }) {
  if (links.length === 0) {
    return (
      <div className="dep-empty">
        <DocIcon />
        <p>No links registered.</p>
        <p className="dep-empty-sub">Add links to your <code>catalog-info.yaml</code> to surface runbooks, dashboards, and docs here.</p>
      </div>
    );
  }

  return (
    <div className="doc-list">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="doc-row"
        >
          <DocIcon />
          <div style={{ flex: 1 }}>
            <div className="doc-title">{link.title ?? link.url}</div>
            <div className="doc-sub">{link.type}</div>
          </div>
          <ExternalIcon />
        </a>
      ))}
    </div>
  );
}

function Ring({ score }: { score: number }) {
  const r = 42;
  const w = 7;
  const size = (r + w) * 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={r + w} cy={r + w} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={w} />
      <circle
        cx={r + w} cy={r + w} r={r}
        fill="none"
        stroke="white"
        strokeWidth={w}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

function CircleDot({ color }: { color: string }) {
  return <svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3.5" fill={color} /></svg>;
}

function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function StarIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}

function CheckIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.25"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

function AlertIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2.25"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
}

function DocIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}

function ExternalIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
}

function DepIcon() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
