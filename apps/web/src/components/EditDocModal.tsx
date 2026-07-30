import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ServiceDoc } from '@daleelex/shared';
import { api } from '../api';
import { DocMarkdown } from './DocMarkdown';
import './EditDocModal.css';

export function EditDocModal({
  serviceId,
  doc,
  onClose,
  onUpdated,
}: {
  serviceId: string;
  doc: ServiceDoc;
  onClose: () => void;
  onUpdated?: (doc: ServiceDoc) => void;
}) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [filename, setFilename] = useState(doc.path.replace(/^manual\//, ''));
  const [contentMd, setContentMd] = useState(doc.contentMd);
  const mutation = useMutation({
    mutationFn: async () =>
      api.updateServiceDoc(serviceId, doc.id, { filename, contentMd }, (await getToken()) ?? ''),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['service-doc'] }),
        queryClient.invalidateQueries({ queryKey: ['service-docs', serviceId] }),
        queryClient.invalidateQueries({ queryKey: ['techdocs-index'] }),
      ]);
      onUpdated?.(updated);
      onClose();
    },
  });
  const dirty = filename !== doc.path.replace(/^manual\//, '') || contentMd !== doc.contentMd;
  const safeClose = useCallback(() => {
    if (!dirty || window.confirm('Discard your unsaved document changes?')) onClose();
  }, [dirty, onClose]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') safeClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [safeClose]);

  return (
    <>
      <div className="modal-backdrop" />
      <dialog className="doc-edit-modal" open aria-modal="true" aria-label={`Edit ${doc.title}`}>
        <header>
          <div>
            <div className="modal-kicker">Managed in DaleelEx</div>
            <h2>Edit document</h2>
          </div>
          <button onClick={safeClose} aria-label="Close">
            ×
          </button>
        </header>
        {mutation.error && (
          <div className="modal-error" role="alert">
            {(mutation.error as Error).message}
          </div>
        )}
        <label className="doc-edit-filename">
          <span>Filename</span>
          <input value={filename} onChange={(event) => setFilename(event.target.value)} />
        </label>
        <div className="doc-edit-grid">
          <label>
            <span>Markdown</span>
            <textarea
              value={contentMd}
              onChange={(event) => setContentMd(event.target.value)}
              spellCheck
            />
          </label>
          <section aria-label="Markdown preview">
            <span>Preview</span>
            <div className="doc-edit-preview">
              <DocMarkdown doc={{ ...doc, contentMd }} />
            </div>
          </section>
        </div>
        <footer>
          <button onClick={safeClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button
            className="doc-edit-save"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !filename.trim() || !contentMd.trim()}
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </dialog>
    </>
  );
}
