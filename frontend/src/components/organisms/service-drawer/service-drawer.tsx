import { useState, useEffect, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { X, Trash2, Star, FileText, ExternalLink, ChevronRight, ArrowLeft, CheckCircle2, AlertCircle, GitBranch } from 'lucide-react';
import { ServicesApi } from '../../../services/services.service';
import { DocsApi } from '../../../services/docs.service';
import type { Service, ServiceLink, ServiceDocSummary } from '../../../types/catalog.types';
import './service-drawer.scss';

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
    onDeleteSuccess?: (service: Service) => void;
}

function deriveChecks(service: Service) {
    return [
        { label: 'Owner assigned', pass: service.owner !== null },
        { label: 'On-call rotation configured', pass: !!service.owner?.onCallSchedule },
        { label: 'SLO defined', pass: !!service.sloTarget },
        { label: 'Runbook linked', pass: service.links.some((l) => l.type === 'runbook') },
        { label: 'Repository linked', pass: !!service.repository },
        { label: 'Description present', pass: !!service.description },
    ];
}

export function ServiceDrawer({ service, onClose, onDeleteSuccess }: Props) {
    const [tab, setTab] = useState<Tab>('overview');
    const [confirming, setConfirming] = useState(false);
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: (target: Service) => ServicesApi.remove(target.id),
        onSuccess: (_data, deletedService) => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            onDeleteSuccess?.(deletedService);
            onClose();
        },
    });

    useEffect(() => {
        setTab('overview');
        setConfirming(false);
    }, [service?.id]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!service) return null;

    const checks = deriveChecks(service);
    const passed = checks.filter((c) => c.pass).length;
    const score = Math.round((passed / checks.length) * 100);
    const deleteError = deleteMutation.error instanceof Error ? deleteMutation.error.message : null;

    return (
        <>
            <div className="drawer-backdrop" onClick={onClose} />
            <aside className="drawer" role="dialog" aria-modal="true" aria-label={service.name}>
                <div className="drawer-head">
                    <button className="drawer-icon-btn" onClick={onClose} aria-label="Close" type="button">
                        <X size={16} />
                    </button>
                    <div style={{ flex: 1 }} />
                    {confirming ? (
                        <div className="delete-confirm">
                            <span className="delete-confirm-label">Delete this service?</span>
                            <button className="ghost-btn delete-confirm-yes" onClick={() => deleteMutation.mutate(service)} disabled={deleteMutation.isPending} type="button">
                                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                            </button>
                            <button className="ghost-btn" onClick={() => setConfirming(false)} disabled={deleteMutation.isPending} type="button">
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <>
                            <button className="ghost-btn" onClick={() => setConfirming(true)} type="button">
                                <Trash2 size={12} /> Delete
                            </button>
                            <button className="ghost-btn" type="button">
                                <Star size={12} /> Watch
                            </button>
                        </>
                    )}
                </div>

                {deleteError && (
                    <div className="drawer-alert error" role="alert">
                        {deleteError}
                    </div>
                )}

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
                            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} type="button">
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="tab-content">
                        {tab === 'overview' && <OverviewTab service={service} />}
                        {tab === 'scorecard' && <ScorecardTab checks={checks} passed={passed} score={score} />}
                        {tab === 'dependencies' && <DependenciesTab />}
                        {tab === 'docs' && <DocsTab serviceId={service.id} links={service.links} />}
                    </div>
                </div>
            </aside>
        </>
    );
}

const OverviewTab = memo<{ service: Service }>(({ service }) => (
    <>
        <div className="kv-grid">
            <div className="kv"><div className="meta-label">Owner team</div><div className="meta-value">{service.owner?.name ?? '—'}</div></div>
            <div className="kv"><div className="meta-label">Language</div><div className="meta-value">{service.language ?? '—'}</div></div>
            <div className="kv"><div className="meta-label">SLO target</div><div className="meta-value">{service.sloTarget ?? '—'}</div></div>
            <div className="kv"><div className="meta-label">Tier</div><div className="meta-value">Tier {service.tier}</div></div>
            <div className="kv"><div className="meta-label">Lifecycle</div><div className="meta-value">{service.lifecycle}</div></div>
            <div className="kv"><div className="meta-label">Repository</div><div className="meta-value mono">{service.repository ?? '—'}</div></div>
        </div>

        {service.tags.length > 0 && (
            <>
                <h4 className="section-title">Tags</h4>
                <div>
                    {service.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
            </>
        )}

        {service.links.length > 0 && (
            <>
                <h4 className="section-title">Links</h4>
                <div className="doc-list">
                    {service.links.map((link) => (
                        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="doc-row">
                            <ExternalLink size={15} color="var(--accent)" />
                            <div style={{ flex: 1 }}>
                                <div className="doc-title">{link.title ?? link.url}</div>
                                <div className="doc-sub">{link.type}</div>
                            </div>
                        </a>
                    ))}
                </div>
            </>
        )}
    </>
));
OverviewTab.displayName = 'OverviewTab';

const ScorecardTab = memo<{ checks: ReturnType<typeof deriveChecks>; passed: number; score: number }>(({ checks, passed, score }) => (
    <>
        <div className="score-hero">
            <div className="ring-wrap">
                <Ring score={score} />
                <span className="ring-pct">{score}%</span>
            </div>
            <div>
                <div className="score-hero-label">Production readiness</div>
                <div className="score-hero-main">{passed} / {checks.length} checks passing</div>
                <div className="score-hero-sub">Based on catalog metadata completeness</div>
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
));
ScorecardTab.displayName = 'ScorecardTab';

const DependenciesTab = memo(() => (
    <div className="dep-empty">
        <GitBranch size={32} color="var(--muted)" />
        <p>Dependency mapping coming soon.</p>
        <p className="dep-empty-sub">Service-to-service dependencies will appear here once populated.</p>
    </div>
));
DependenciesTab.displayName = 'DependenciesTab';

const DocsTab = memo<{ serviceId: string; links: ServiceLink[] }>(({ serviceId, links }) => {
    const [selectedDoc, setSelectedDoc] = useState<ServiceDocSummary | null>(null);

    const { data: docList, isLoading: listLoading } = useQuery({
        queryKey: ['service-docs', serviceId],
        queryFn: () => DocsApi.forService(serviceId),
    });

    const { data: docContent, isLoading: contentLoading } = useQuery({
        queryKey: ['service-doc', serviceId, selectedDoc?.id],
        queryFn: () => DocsApi.content(serviceId, selectedDoc!.id),
        enabled: selectedDoc !== null,
    });

    const docs = docList?.data ?? [];
    const hasLinks = links.length > 0;

    if (listLoading) return <div className="docs-loading">Loading docs…</div>;

    if (selectedDoc) {
        return (
            <div className="techdocs-view">
                <button className="docs-back-btn" onClick={() => setSelectedDoc(null)} type="button">
                    <ArrowLeft size={13} /> All pages
                </button>
                <div className="techdocs-title">{selectedDoc.title}</div>
                <div className="techdocs-path">{selectedDoc.path}</div>
                {contentLoading ? (
                    <div className="docs-loading">Loading…</div>
                ) : (
                    <div className="techdocs-body">
                        <ReactMarkdown>{docContent?.contentMd ?? ''}</ReactMarkdown>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div>
            {docs.length > 0 && (
                <>
                    <h4 className="section-title">Documentation</h4>
                    <div className="doc-list">
                        {docs.map((doc) => (
                            <button key={doc.id} className="doc-row doc-row-btn" onClick={() => setSelectedDoc(doc)} type="button">
                                <FileText size={15} color="var(--accent)" />
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                    <div className="doc-title">{doc.title}</div>
                                    <div className="doc-sub">{doc.path}</div>
                                </div>
                                <ChevronRight size={13} />
                            </button>
                        ))}
                    </div>
                </>
            )}

            {hasLinks && (
                <>
                    <h4 className="section-title">Links</h4>
                    <div className="doc-list">
                        {links.map((link) => (
                            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="doc-row">
                                <FileText size={15} color="var(--accent)" />
                                <div style={{ flex: 1 }}>
                                    <div className="doc-title">{link.title ?? link.url}</div>
                                    <div className="doc-sub">{link.type}</div>
                                </div>
                                <ExternalLink size={12} />
                            </a>
                        ))}
                    </div>
                </>
            )}

            {docs.length === 0 && !hasLinks && (
                <div className="dep-empty">
                    <FileText size={32} color="var(--muted)" />
                    <p>No docs yet.</p>
                    <p className="dep-empty-sub">Add a <code>docs/</code> directory to the service repo to see it indexed here.</p>
                </div>
            )}
        </div>
    );
});
DocsTab.displayName = 'DocsTab';

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

function CircleDot({ color }: { color: string }) {
    return <svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3.5" fill={color} /></svg>;
}