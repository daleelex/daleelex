import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { DocsApi } from '../../services/docs.service';
import type { ServiceDocSummary, TechDocsIndexEntry } from '../../types/catalog.types';
import './documentation.scss';

export function TechDocsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedServiceId = searchParams.get('service');
    const selectedDocId = searchParams.get('doc') ? Number(searchParams.get('doc')) : null;
    const [search, setSearch] = useState('');

    const { data: index, isLoading } = useQuery({
        queryKey: ['techdocs-index'],
        queryFn: () => DocsApi.index(),
    });

    const { data: docContent, isLoading: contentLoading } = useQuery({
        queryKey: ['service-doc', selectedServiceId, selectedDocId],
        queryFn: () => DocsApi.content(selectedServiceId!, selectedDocId!),
        enabled: selectedServiceId !== null && selectedDocId !== null,
    });

    const entries = index?.data ?? [];
    const filtered = search.trim()
        ? entries.filter((e) =>
            e.service.name.toLowerCase().includes(search.toLowerCase()) ||
            e.docs.some((d) => d.title.toLowerCase().includes(search.toLowerCase()))
        )
        : entries;

    const selectedEntry = entries.find((e) => e.service.id === selectedServiceId);
    const selectedDoc = selectedEntry?.docs.find((d) => d.id === selectedDocId);

    function selectDoc(serviceId: string, docId: number) {
        setSearchParams({ service: serviceId, doc: String(docId) });
    }

    return (
        <div className="techdocs-page">
            <aside className="techdocs-nav">
                <div className="techdocs-nav-head">
                    <h2 className="techdocs-nav-title">TechDocs</h2>
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
                    {!isLoading && filtered.length === 0 && (
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
                            <div className="techdocs-breadcrumb">
                                <span className="techdocs-bc-service">{selectedEntry?.service.name ?? selectedServiceId}</span>
                                {selectedDoc && <><span className="techdocs-bc-sep">/</span><span>{selectedDoc.title}</span></>}
                            </div>
                            {selectedDoc && (
                                <div className="techdocs-content-path">{selectedDoc.path}</div>
                            )}
                        </div>

                        <div className="techdocs-content-body">
                            {contentLoading && <div className="techdocs-spinner">Loading…</div>}
                            {!contentLoading && docContent && (
                                <div className="techdocs-prose">
                                    <ReactMarkdown>{docContent.contentMd}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
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

function DocPageItem({ doc, active, onClick }: { doc: ServiceDocSummary; active: boolean; onClick: () => void }) {
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

function WelcomeIcon() {
    return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--line-strong)" strokeWidth="1.25">
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
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    );
}