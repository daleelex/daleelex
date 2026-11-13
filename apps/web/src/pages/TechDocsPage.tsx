import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type {
  ServiceDocSummary,
  TechDocsIndexEntry,
  UploadServiceDocResponse,
} from '@daleelex/shared';
import { DocMarkdown } from '../components/DocMarkdown';
import { UploadDocsModal } from '../components/UploadDocsModal';
import { EditDocModal } from '../components/EditDocModal';
import { timeAgo } from '../lib/time';
// For the shared tier badge.
import '../components/ServiceCard.css';
import './TechDocsPage.css';

// How many doc links a library card lists before it summarises the rest.
const LIBRARY_DOC_LIMIT = 4;

interface OutlineItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function TechDocsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedServiceId = searchParams.get('service');
  const selectedDocId = searchParams.get('doc') ? Number(searchParams.get('doc')) : null;
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState(false);

  // Navigating to another doc (sidebar, back button) must not leave the
  // editor open against content it wasn't opened for.
  useEffect(() => setEditingDoc(false), [selectedServiceId, selectedDocId]);

  const {
    data: index,
    isLoading,
    isError: indexError,
  } = useQuery({
    queryKey: ['techdocs-index'],
    queryFn: () => api.techDocsIndex(),
  });

  const { data: servicesResponse } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const {
    data: docContent,
    isLoading: contentLoading,
    isError: contentError,
  } = useQuery({
    queryKey: ['service-doc', selectedServiceId, selectedDocId],
    queryFn: () => api.serviceDoc(selectedServiceId!, selectedDocId!),
    enabled: selectedServiceId !== null && selectedDocId !== null,
  });

  const entries = index?.data ?? [];
  const filtered = search.trim()
    ? entries.filter(
        (e) =>
          e.service.name.toLowerCase().includes(search.toLowerCase()) ||
          e.docs.some((d) => d.title.toLowerCase().includes(search.toLowerCase())),
      )
    : entries;

  const selectedEntry = entries.find((e) => e.service.id === selectedServiceId);
  const selectedDoc = selectedEntry?.docs.find((d) => d.id === selectedDocId);
  const docCount = entries.reduce((sum, entry) => sum + entry.docs.length, 0);

  const siblings = selectedEntry?.docs ?? [];
  const position = siblings.findIndex((d) => d.id === selectedDocId);
  const previousDoc = position > 0 ? siblings[position - 1] : null;
  const nextDoc = position >= 0 && position < siblings.length - 1 ? siblings[position + 1] : null;

  // The outline is read from the rendered headings rather than parsed from the
  // Markdown, so it always matches what is on screen.
  const proseRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  useEffect(() => {
    const headings = proseRef.current?.querySelectorAll('h2, h3') ?? [];
    setOutline(
      Array.from(headings, (heading, i) => {
        heading.id = `doc-section-${i}`;
        return {
          id: heading.id,
          text: heading.textContent ?? '',
          level: heading.tagName === 'H2' ? 2 : 3,
        };
      }),
    );
  }, [docContent]);

  function jumpTo(id: string) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function selectDoc(serviceId: string, docId: number) {
    setSearchParams({ service: serviceId, doc: String(docId) });
  }

  async function handleUploaded(serviceId: string, results: UploadServiceDocResponse[]) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['techdocs-index'] }),
      queryClient.invalidateQueries({ queryKey: ['stats'] }),
      // An overwrite can replace the doc currently on screen; without this the
      // cached content keeps rendering because the URL params don't change.
      queryClient.invalidateQueries({ queryKey: ['service-doc'] }),
    ]);
    const first = results[0];
    setSearchParams({ service: serviceId, doc: String(first.data.id) });
    const created = results.filter((result) => result.operation === 'created').length;
    const updated = results.length - created;
    const parts = [created ? `${created} created` : '', updated ? `${updated} updated` : ''].filter(
      Boolean,
    );
    setNotice(`Upload complete: ${parts.join(', ')}.`);
  }

  return (
    <div className={`techdocs-page${selectedServiceId && selectedDocId ? ' has-doc' : ''}`}>
      <aside className="techdocs-nav">
        <div className="techdocs-nav-head">
          <div className="techdocs-title-row">
            <h2 className="techdocs-nav-title">TechDocs</h2>
            <button
              className="techdocs-upload-button"
              type="button"
              onClick={() => setUploading(true)}
              disabled={!servicesResponse?.data.length}
            >
              <UploadIcon />
              Upload
            </button>
          </div>
          <p className="techdocs-nav-sub">
            {docCount} {docCount === 1 ? 'doc' : 'docs'} · {entries.length}{' '}
            {entries.length === 1 ? 'service' : 'services'}
          </p>
          <input
            className="techdocs-search"
            type="search"
            placeholder="Search docs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search documentation"
          />
        </div>

        <div className="techdocs-nav-list">
          {isLoading && <div className="techdocs-nav-empty">Loading…</div>}
          {indexError && <div className="techdocs-nav-empty">Failed to load documentation.</div>}
          {!isLoading && !indexError && filtered.length === 0 && (
            <div className="techdocs-nav-empty">No docs found.</div>
          )}
          {filtered.map((entry) => (
            <ServiceDocGroup
              key={entry.service.id}
              entry={entry}
              selectedDocId={selectedDocId}
              selectedServiceId={selectedServiceId}
              onSelect={selectDoc}
            />
          ))}
        </div>
      </aside>

      <div className="techdocs-content">
        {notice && (
          <div className="techdocs-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {!(selectedServiceId && selectedDocId) && (
          <div className="techdocs-library">
            <header className="techdocs-library-head">
              <h1 className="techdocs-library-title">TechDocs</h1>
              <p className="techdocs-library-sub">
                {isLoading
                  ? 'Loading documentation…'
                  : indexError
                    ? 'Documentation could not be loaded. Check the API.'
                    : entries.length === 0
                      ? 'No documentation yet. Upload a Markdown file to get started.'
                      : 'Runbooks, overviews and guides, kept next to the services they describe.'}
              </p>
            </header>

            {!isLoading && !indexError && entries.length > 0 && filtered.length === 0 && (
              <p className="techdocs-library-sub">No docs match “{search.trim()}”.</p>
            )}

            <div className="techdocs-library-grid">
              {filtered.map((entry) => (
                <section key={entry.service.id} className="library-card">
                  <div className="library-card-head">
                    <h2 className="library-card-title">{entry.service.name}</h2>
                    <span className={`tier-badge tier-${entry.service.tier}`}>
                      T{entry.service.tier}
                    </span>
                  </div>
                  <div className="library-card-id">{entry.service.id}</div>
                  <div className="library-card-docs">
                    {entry.docs.slice(0, LIBRARY_DOC_LIMIT).map((doc) => (
                      <button
                        key={doc.id}
                        className="library-doc"
                        onClick={() => selectDoc(entry.service.id, doc.id)}
                      >
                        <PageIcon />
                        <span>{doc.title}</span>
                        <ChevronIcon />
                      </button>
                    ))}
                  </div>
                  {entry.docs.length > LIBRARY_DOC_LIMIT && (
                    <div className="library-card-more">
                      +{entry.docs.length - LIBRARY_DOC_LIMIT} more in the sidebar
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}

        {selectedServiceId && selectedDocId && (
          <>
            <div className="techdocs-content-head">
              <button
                className="techdocs-back"
                type="button"
                onClick={() => setSearchParams({})}
                aria-label="Back to all docs"
              >
                <ChevronIcon flipped />
                All docs
              </button>
              <div className="techdocs-content-heading">
                <div className="techdocs-content-meta">
                  <div className="techdocs-breadcrumb">
                    <span className="techdocs-bc-service">
                      {selectedEntry?.service.name ?? selectedServiceId}
                    </span>
                    {selectedDoc && (
                      <>
                        <span className="techdocs-bc-sep">/</span>
                        <span>{selectedDoc.title}</span>
                      </>
                    )}
                  </div>
                  {selectedDoc && (
                    <div className="techdocs-content-path">
                      <span>{displayDocPath(selectedDoc.path)}</span>
                      {docContent && (
                        // fetchedAt moves on every sync, upload and edit.
                        <span>
                          {docContent.sourceRepository
                            ? `Synced from ${docContent.sourceRepository}`
                            : 'Updated'}{' '}
                          {timeAgo(docContent.fetchedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {selectedDoc &&
                  (docContent?.sourceRepository ? (
                    // GitHub's /edit/ route needs a branch; sourceSha is a
                    // commit, so link the permalink to the synced revision.
                    // No pencil here on purpose — this one navigates, it doesn't edit.
                    <a
                      className="techdocs-edit-button"
                      href={`https://github.com/${docContent.sourceRepository}/blob/${docContent.sourceSha ?? 'HEAD'}/${docContent.path}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View in repository
                    </a>
                  ) : (
                    docContent && (
                      <button
                        className="techdocs-edit-button"
                        type="button"
                        onClick={() => setEditingDoc(true)}
                      >
                        <EditIcon />
                        Edit
                      </button>
                    )
                  ))}
              </div>
            </div>

            {/* Keyed so each doc starts at the top instead of the last scroll position. */}
            <div className="techdocs-content-body" key={`${selectedServiceId}-${selectedDocId}`}>
              <div className="techdocs-reader">
                <article className="techdocs-paper">
                  {contentLoading && <div className="techdocs-spinner">Loading…</div>}
                  {contentError && (
                    <div className="techdocs-spinner">Failed to load this document.</div>
                  )}
                  {!contentLoading && docContent && (
                    <div className="techdocs-prose" ref={proseRef}>
                      <DocMarkdown doc={docContent} />
                    </div>
                  )}
                </article>

                {(previousDoc || nextDoc) && (
                  <nav className="techdocs-pager" aria-label="More docs for this service">
                    {previousDoc ? (
                      <button
                        className="techdocs-pager-link"
                        onClick={() => selectDoc(selectedServiceId, previousDoc.id)}
                      >
                        <span className="techdocs-pager-label">Previous</span>
                        <span className="techdocs-pager-title">{previousDoc.title}</span>
                      </button>
                    ) : (
                      <span />
                    )}
                    {nextDoc && (
                      <button
                        className="techdocs-pager-link next"
                        onClick={() => selectDoc(selectedServiceId, nextDoc.id)}
                      >
                        <span className="techdocs-pager-label">Next</span>
                        <span className="techdocs-pager-title">{nextDoc.title}</span>
                      </button>
                    )}
                  </nav>
                )}
              </div>

              {outline.length > 1 && (
                <nav className="techdocs-outline" aria-label="On this page">
                  <div className="techdocs-outline-title">On this page</div>
                  {outline.map((item) => (
                    <button
                      key={item.id}
                      className={`techdocs-outline-link level-${item.level}`}
                      onClick={() => jumpTo(item.id)}
                    >
                      {item.text}
                    </button>
                  ))}
                </nav>
              )}
            </div>
          </>
        )}
      </div>

      {uploading && (
        <UploadDocsModal
          services={servicesResponse?.data ?? []}
          docsIndex={entries}
          initialServiceId={selectedServiceId}
          onUploaded={handleUploaded}
          onClose={() => setUploading(false)}
        />
      )}
      {editingDoc && docContent && !docContent.sourceRepository && (
        <EditDocModal
          serviceId={selectedServiceId!}
          doc={docContent}
          onClose={() => setEditingDoc(false)}
          onUpdated={() => setNotice('Document updated.')}
        />
      )}
    </div>
  );
}

function ServiceDocGroup({
  entry,
  selectedDocId,
  selectedServiceId,
  onSelect,
}: {
  entry: TechDocsIndexEntry;
  selectedDocId: number | null;
  selectedServiceId: string | null;
  onSelect: (serviceId: string, docId: number) => void;
}) {
  const isActive = entry.service.id === selectedServiceId;

  return (
    <div className={`doc-group${isActive ? ' doc-group-active' : ''}`}>
      <div className="doc-group-service">
        <span className="doc-group-name">{entry.service.name}</span>
        <span className={`tier-badge tier-${entry.service.tier}`}>T{entry.service.tier}</span>
        <span className="doc-group-count">{entry.docs.length}</span>
      </div>
      <div className="doc-group-pages">
        {entry.docs.map((doc) => (
          <DocPageItem
            key={doc.id}
            doc={doc}
            active={doc.id === selectedDocId && isActive}
            onClick={() => onSelect(entry.service.id, doc.id)}
          />
        ))}
      </div>
    </div>
  );
}

function DocPageItem({
  doc,
  active,
  onClick,
}: {
  doc: ServiceDocSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`doc-page-item${active ? ' active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <PageIcon />
      <span>{doc.title}</span>
    </button>
  );
}

function displayDocPath(path: string) {
  return path.startsWith('manual/') ? path.slice('manual/'.length) : path;
}

function UploadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 16V4" />
      <polyline points="7 9 12 4 17 9" />
      <path d="M20 15v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4" />
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

function ChevronIcon({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ flexShrink: 0, transform: flipped ? 'scaleX(-1)' : undefined }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PageIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
