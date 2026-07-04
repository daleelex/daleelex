import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TeamWithStats } from '../../../types/catalog.types';
import './team-drawer.scss';

type Tab = 'overview' | 'services' | 'scorecard';
const TABS: Tab[] = ['overview', 'services', 'scorecard'];

interface Props {
    team: TeamWithStats | null;
    onClose: () => void;
}

function initials(name: string) {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function TeamDrawer({ team, onClose }: Props) {
    const [tab, setTab] = useState<Tab>('overview');

    useEffect(() => { setTab('overview'); }, [team?.id]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!team) return null;

    const totalChecks = 4;
    const passedChecks = [
        team.slackChannel !== null,
        team.onCallSchedule !== null,
        team.serviceCount > 0,
        team.tier1Count === 0 || team.onCallSchedule !== null,
    ].filter(Boolean).length;
    const score = Math.round((passedChecks / totalChecks) * 100);

    return (
        <>
            <div className="drawer-backdrop" onClick={onClose} />
            <aside className="drawer" role="dialog" aria-modal="true" aria-label={team.name}>
                <div className="drawer-head">
                    <button className="drawer-icon-btn" onClick={onClose} aria-label="Close" type="button">
                        <X size={16} />
                    </button>
                    <div style={{ flex: 1 }} />
                </div>

                <div className="drawer-body">
                    <div className="team-drawer-hero">
                        <div className="team-drawer-avatar">{initials(team.name)}</div>
                        <div>
                            <h2 className="drawer-title" style={{ fontSize: 28, marginTop: 0 }}>{team.name}</h2>
                            <div className="drawer-id">{team.id}</div>
                        </div>
                    </div>

                    <div className="tabs">
                        {TABS.map((t) => (
                            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} type="button">
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="tab-content">
                        {tab === 'overview' && <TeamOverviewTab team={team} />}
                        {tab === 'services' && <TeamServicesTab team={team} />}
                        {tab === 'scorecard' && <TeamScorecardTab team={team} passed={passedChecks} score={score} />}
                    </div>
                </div>
            </aside>
        </>
    );
}

function TeamOverviewTab({ team }: { team: TeamWithStats }) {
    return (
        <>
            <div className="kv-grid">
                <div className="kv"><div className="meta-label">Slack channel</div><div className="meta-value">{team.slackChannel ?? '—'}</div></div>
                <div className="kv"><div className="meta-label">On-call schedule</div><div className="meta-value">{team.onCallSchedule ?? 'Not configured'}</div></div>
                <div className="kv"><div className="meta-label">Total services</div><div className="meta-value">{team.serviceCount}</div></div>
                <div className="kv"><div className="meta-label">Critical (Tier 1)</div><div className="meta-value">{team.tier1Count}</div></div>
            </div>

            <h4 className="section-title">Service tiers</h4>
            <div className="tier-breakdown">
                {team.tier1Count > 0 && (
                    <div className="tier-bar-row">
                        <span className="tier-bar-label tier-1">T1</span>
                        <div className="tier-bar-track"><div className="tier-bar-fill tier-fill-1" style={{ width: `${(team.tier1Count / team.serviceCount) * 100}%` }} /></div>
                        <span className="tier-bar-count">{team.tier1Count}</span>
                    </div>
                )}
                {team.tier2Count > 0 && (
                    <div className="tier-bar-row">
                        <span className="tier-bar-label tier-2">T2</span>
                        <div className="tier-bar-track"><div className="tier-bar-fill tier-fill-2" style={{ width: `${(team.tier2Count / team.serviceCount) * 100}%` }} /></div>
                        <span className="tier-bar-count">{team.tier2Count}</span>
                    </div>
                )}
                {team.tier3Count > 0 && (
                    <div className="tier-bar-row">
                        <span className="tier-bar-label tier-3">T3</span>
                        <div className="tier-bar-track"><div className="tier-bar-fill tier-fill-3" style={{ width: `${(team.tier3Count / team.serviceCount) * 100}%` }} /></div>
                        <span className="tier-bar-count">{team.tier3Count}</span>
                    </div>
                )}
                {team.serviceCount === 0 && <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>No services owned yet.</p>}
            </div>
        </>
    );
}

function TeamServicesTab({ team }: { team: TeamWithStats }) {
    if (team.topServices.length === 0) {
        return <div className="dep-empty"><p>No services owned by this team yet.</p></div>;
    }

    return (
        <div className="doc-list">
            {team.topServices.map((s) => (
                <div key={s.id} className="team-svc-row">
                    <span className={`service-tier-dot tier-dot-${s.tier}`} />
                    <div style={{ flex: 1 }}>
                        <div className="doc-title">{s.name}</div>
                        <div className="doc-sub">{s.type} · tier {s.tier}</div>
                    </div>
                    <span className={`tier-badge tier-${s.tier}`}>T{s.tier}</span>
                </div>
            ))}
            {team.serviceCount > team.topServices.length && (
                <div className="team-svc-more">+{team.serviceCount - team.topServices.length} more services</div>
            )}
        </div>
    );
}

function TeamScorecardTab({ team, passed, score }: { team: TeamWithStats; passed: number; score: number }) {
    const checks = [
        { label: 'Slack channel configured', pass: !!team.slackChannel },
        { label: 'On-call rotation active', pass: !!team.onCallSchedule },
        { label: 'At least one service owned', pass: team.serviceCount > 0 },
        { label: 'Critical services have on-call', pass: team.tier1Count === 0 || !!team.onCallSchedule },
    ];

    return (
        <>
            <div className="score-hero">
                <div className="ring-wrap">
                    <Ring score={score} />
                    <span className="ring-pct">{score}%</span>
                </div>
                <div>
                    <div className="score-hero-label">Team health</div>
                    <div className="score-hero-main">{passed} / {checks.length} checks passing</div>
                    <div className="score-hero-sub">Based on team configuration</div>
                </div>
            </div>

            <h4 className="section-title">Checks</h4>
            <div>
                {checks.map((c) => (
                    <div key={c.label} className={`check-row${c.pass ? ' pass' : ' fail'}`}>
                        {c.pass ? <CheckCircle2 size={15} color="var(--ok)" /> : <AlertCircle size={15} color="var(--warn)" />}
                        <span className="check-label">{c.label}</span>
                        <span className={`check-status${c.pass ? ' pass' : ' fail'}`}>{c.pass ? 'pass' : 'action needed'}</span>
                    </div>
                ))}
            </div>
        </>
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
            <circle cx={r + w} cy={r + w} r={r} fill="none" stroke="white" strokeWidth={w} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
    );
}