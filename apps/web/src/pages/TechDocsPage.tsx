import { useEffect, useState } from 'react';
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
import './TechDocsPage.css';

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
    <div className="techdocs-page">
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
          <p className="techdocs-nav-sub">{entries.length} services with docs</p>
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
        {!selectedServiceId && (
          <div className="techdocs-welcome">
            <WelcomeIcon />
            <h2 className="techdocs-welcome-title">Pick a doc to read</h2>
            <p className="techdocs-welcome-sub">
              Select a service from the left to browse its documentation.
            </p>
          </div>
        )}

        {selectedServiceId && selectedDocId && (
          <>
            <div className="techdocs-content-head">
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
                      {displayDocPath(selectedDoc.path)}
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

            <div className="techdocs-content-body">
              {contentLoading && <div className="techdocs-spinner">Loading…</div>}
              {contentError && (
                <div className="techdocs-spinner">Failed to load this document.</div>
              )}
              {!contentLoading && docContent && (
                <div className="techdocs-prose">
                  <DocMarkdown doc={docContent} />
                </div>
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
        <span className={`doc-group-tier tier-${entry.service.tier}`}>T{entry.service.tier}</span>
        <span className="doc-group-name">{entry.service.name}</span>
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

function WelcomeIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--line-strong)"
      strokeWidth="1.25"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
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
