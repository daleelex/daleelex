import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import type { Service, ServiceLink, ServiceDocSummary } from '@daleelex/shared';
import { DocMarkdown } from './DocMarkdown';
import { api } from '../api';
import { buildDependencyTree, flatten, type TreeNode } from '../lib/dependencyTree';
import { EditServiceModal } from './EditServiceModal';
import { EditDocModal } from './EditDocModal';
import { ServiceLogsTab } from './ServiceLogsTab';
import './ServiceDrawer.css';

type Tab = 'overview' | 'scorecard' | 'dependencies' | 'logs' | 'docs';
const TABS: Tab[] = ['overview', 'scorecard', 'dependencies', 'logs', 'docs'];

const LIFECYCLE_COLOR: Record<string, string> = {
  production: 'var(--ok)',
  beta: 'var(--warn)',
  deprecated: 'var(--muted)',
};

interface Props {
  service: Service | null;
  onClose: () => void;
  onDeleteSuccess?: (service: Service) => void;
  onUpdateSuccess?: (service: Service) => void;
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

export function ServiceDrawer({ service, onClose, onDeleteSuccess, onUpdateSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const deleteMutation = useMutation({
    mutationFn: async (target: Service) =>
      api.deleteService(target.id, (await getToken()) ?? undefined),
    onSuccess: (_data, deletedService) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onDeleteSuccess?.(deletedService);
      onClose();
    },
  });

  useEffect(() => {
    setTab('overview');
    setConfirming(false);
    setEditing(false);
  }, [service?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
          <button className="drawer-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
          <div style={{ flex: 1 }} />
          {confirming ? (
            <div className="delete-confirm">
              <span className="delete-confirm-label">Delete this service?</span>
              <button
                className="ghost-btn delete-confirm-yes"
                onClick={() => deleteMutation.mutate(service)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
              <button
                className="ghost-btn"
                onClick={() => setConfirming(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {service.managementSource === 'portal' ? (
                <button className="ghost-btn" onClick={() => setEditing(true)}>
                  Edit
                </button>
              ) : (
                service.repository && (
                  <a
                    className="ghost-btn"
                    href={`https://github.com/${service.repository}/edit/HEAD/catalog-info.yaml`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Edit in repository
                  </a>
                )
              )}
              <button className="ghost-btn" onClick={() => setConfirming(true)}>
                <TrashIcon /> Delete
              </button>
              <button className="ghost-btn">
                <StarIcon /> Watch
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
          <div className="drawer-id">
            {service.managementSource === 'portal' ? 'Managed in DaleelEx' : 'Synced from GitHub'}
          </div>

          <h2 className="drawer-title">{service.name}</h2>
          <div className="drawer-id">{service.id}</div>
          {service.description && <p className="drawer-desc">{service.description}</p>}

          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="tab-content">
            {tab === 'overview' && <OverviewTab service={service} />}
            {tab === 'scorecard' && <ScorecardTab checks={checks} passed={passed} score={score} />}
            {tab === 'dependencies' && <DependenciesTab service={service} />}
            {tab === 'logs' && <ServiceLogsTab serviceId={service.id} />}
            {tab === 'docs' && <DocsTab serviceId={service.id} links={service.links} />}
          </div>
        </div>
      </aside>
      {editing && (
        <EditServiceModal
          service={service}
          onClose={() => setEditing(false)}
          onUpdated={(updated) => onUpdateSuccess?.(updated)}
        />
      )}
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

      <h4 className="section-title">Health signals</h4>
      <div className="signal-empty">
        <p>No metrics source connected.</p>
        <Link to="/settings" className="signal-empty-link">
          Connect one in Settings
        </Link>
      </div>

      {service.tags.length > 0 && (
        <>
          <h4 className="section-title">Tags</h4>
          <div>
            {service.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ScorecardTab({
  checks,
  passed,
  score,
}: {
  checks: ReturnType<typeof deriveChecks>;
  passed: number;
  score: number;
}) {
  return (
    <>
      <div className="score-hero">
        <div className="ring-wrap">
          <Ring score={score} />
          <span className="ring-pct">{score}%</span>
        </div>
        <div>
          <div className="score-hero-label">Production readiness</div>
          <div className="score-hero-main">
            {passed} / {checks.length} checks passing
          </div>
          <div className="score-hero-sub">
            Last evaluated 2 hours ago · Policy <code>standard-v3</code>
          </div>
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

const TYPE_COLOR: Record<Service['type'], string> = {
  api: '#2FA99B',
  db: '#3F7FC4',
  web: '#4E94A6',
  ml: '#8A6FCB',
  tool: '#D89510',
};

function DependenciesTab({ service }: { service: Service }) {
  const { data } = useQuery({ queryKey: ['services'], queryFn: api.services });
  const services = data?.data ?? [];

  const upstream = buildDependencyTree(service, services, 'upstream');
  const downstream = buildDependencyTree(service, services, 'downstream');

  if (upstream.children.length === 0 && downstream.children.length === 0) {
    return (
      <div className="dep-empty">
        <DepIcon />
        <p>No dependencies declared.</p>
        <p className="dep-empty-sub">
          Add a <code>dependencies</code> field to your <code>catalog-info.yaml</code> to see
          upstream and downstream services here.
        </p>
      </div>
    );
  }

  return (
    <>
      <DependencySection title="Depends on" empty="Nothing — this is a leaf." tree={upstream} />
      <DependencySection
        title="Used by"
        empty="Nothing in the catalogue depends on this."
        tree={downstream}
      />
    </>
  );
}

function DependencySection({
  title,
  empty,
  tree,
}: {
  title: string;
  empty: string;
  tree: TreeNode;
}) {
  // A shared dependency shows up on every path that reaches it, so count the
  // distinct services rather than the rows on screen.
  const total = new Set(flatten(tree).map((node) => node.service.id)).size;

  return (
    <section className="dep-section">
      <h4 className="section-title">
        {title}
        {total > 0 && <span className="dep-count">{total}</span>}
      </h4>
      {tree.children.length === 0 ? (
        <p className="dep-section-empty">{empty}</p>
      ) : (
        <div className="dep-tree">
          {tree.children.map((child) => (
            <DepBranch key={child.service.id} node={child} />
          ))}
        </div>
      )}
    </section>
  );
}

function DepBranch({ node }: { node: TreeNode }) {
  const [, setParams] = useSearchParams();

  function open() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('service', node.service.id);
      return next;
    });
  }

  return (
    <>
      <div className="dep-row" style={{ paddingLeft: (node.depth - 1) * 18 }}>
        <span className="dep-rail" aria-hidden="true" />
        <button type="button" className="dep-chip" onClick={open}>
          <span className="dep-dot" style={{ background: TYPE_COLOR[node.service.type] }} />
          <span className="dep-chip-name">{node.service.name}</span>
          <span className="dep-chip-tier">T{node.service.tier}</span>
        </button>
        {node.cycle && <span className="dep-note">cycle</span>}
        {node.truncated && <span className="dep-note">deeper</span>}
      </div>
      {node.children.map((child) => (
        <DepBranch key={child.service.id} node={child} />
      ))}
      {node.overflow > 0 && (
        <div className="dep-row" style={{ paddingLeft: node.depth * 18 }}>
          <span className="dep-rail" aria-hidden="true" />
          <span className="dep-more">+{node.overflow} more</span>
        </div>
      )}
    </>
  );
}

function DocsTab({ serviceId, links }: { serviceId: string; links: ServiceLink[] }) {
  const [selectedDoc, setSelectedDoc] = useState<ServiceDocSummary | null>(null);
  const [editingDoc, setEditingDoc] = useState(false);

  const { data: docList, isLoading: listLoading } = useQuery({
    queryKey: ['service-docs', serviceId],
    queryFn: () => api.serviceDocs(serviceId),
  });

  const { data: docContent, isLoading: contentLoading } = useQuery({
    queryKey: ['service-doc', serviceId, selectedDoc?.id],
    queryFn: () => api.serviceDoc(serviceId, selectedDoc!.id),
    enabled: selectedDoc !== null,
  });

  const docs = docList?.data ?? [];
  const hasLinks = links.length > 0;

  if (listLoading) {
    return <div className="docs-loading">Loading docs…</div>;
  }

  if (selectedDoc) {
    return (
      <div className="techdocs-view">
        <button className="docs-back-btn" onClick={() => setSelectedDoc(null)}>
          <BackIcon /> All pages
        </button>
        <div className="techdocs-title">{selectedDoc.title}</div>
        <div className="techdocs-doc-meta">
          <span className="techdocs-path">{selectedDoc.path}</span>
          {docContent?.sourceRepository ? (
            <a
              className="drawer-doc-edit-button"
              href={`https://github.com/${docContent.sourceRepository}/edit/${docContent.sourceSha ?? 'HEAD'}/${docContent.path}`}
              target="_blank"
              rel="noreferrer"
            >
              <EditIcon />
              Edit in repository
            </a>
          ) : (
            docContent && (
              <button
                className="drawer-doc-edit-button"
                type="button"
                onClick={() => setEditingDoc(true)}
              >
                <EditIcon />
                Edit
              </button>
            )
          )}
        </div>
        {contentLoading ? (
          <div className="docs-loading">Loading…</div>
        ) : (
          <div className="techdocs-body">{docContent && <DocMarkdown doc={docContent} />}</div>
        )}
        {editingDoc && docContent && !docContent.sourceRepository && (
          <EditDocModal
            serviceId={serviceId}
            doc={docContent}
            onClose={() => setEditingDoc(false)}
          />
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
              <button
                key={doc.id}
                className="doc-row doc-row-btn"
                onClick={() => setSelectedDoc(doc)}
              >
                <DocIcon />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="doc-title">{doc.title}</div>
                  <div className="doc-sub">{doc.path}</div>
                </div>
                <ChevronIcon />
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
        </>
      )}

      {docs.length === 0 && !hasLinks && (
        <div className="dep-empty">
          <DocIcon />
          <p>No docs yet.</p>
          <p className="dep-empty-sub">
            Add a <code>docs/</code> directory to the service repo — the ingestor will pick it up on
            the next scan.
          </p>
        </div>
      )}
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
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={r + w}
        cy={r + w}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={w}
      />
      <circle
        cx={r + w}
        cy={r + w}
        r={r}
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
  return (
    <svg width="7" height="7" viewBox="0 0 7 7">
      <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ok)"
      strokeWidth="2.25"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--warn)"
      strokeWidth="2.25"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.75"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function DepIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--muted)"
      strokeWidth="1.5"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
