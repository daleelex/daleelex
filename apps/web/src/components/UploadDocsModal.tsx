import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { Service, TechDocsIndexEntry, UploadServiceDocResponse } from '@daleelex/shared';
import { api } from '../api';
import './UploadDocsModal.css';

const MAX_FILE_BYTES = 1024 * 1024;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.md$/;

type UploadFile = {
  file: File;
  error: string | null;
  result: UploadServiceDocResponse | null;
};

interface Props {
  services: Service[];
  docsIndex: TechDocsIndexEntry[];
  initialServiceId: string | null;
  onUploaded: (serviceId: string, results: UploadServiceDocResponse[]) => void;
  onClose: () => void;
}

export function UploadDocsModal({
  services,
  docsIndex,
  initialServiceId,
  onUploaded,
  onClose,
}: Props) {
  const { getToken } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [serviceId, setServiceId] = useState(initialServiceId ?? services[0]?.id ?? '');
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isUploading, onClose]);

  const existingPaths = useMemo(
    () =>
      new Set(
        docsIndex.find((entry) => entry.service.id === serviceId)?.docs.map((doc) => doc.path) ??
          [],
      ),
    [docsIndex, serviceId],
  );
  const hasCollisions = files.some(
    ({ file, error }) => !error && existingPaths.has(`manual/${file.name}`),
  );
  const validFiles = files.filter(({ error }) => !error);
  const finished = files.some(({ result }) => result !== null);

  function selectFiles(selected: FileList | null) {
    if (!selected) return;
    const seen = new Set<string>();
    const next = Array.from(selected).map((file): UploadFile => {
      let error: string | null = null;
      if (seen.has(file.name)) error = 'This file was selected more than once.';
      else if (!SAFE_FILENAME.test(file.name)) {
        error = 'Use letters, numbers, dashes, or underscores only, with a .md extension.';
      } else if (file.size === 0) error = 'Markdown files cannot be empty.';
      else if (file.size > MAX_FILE_BYTES) error = 'File must be 1 MiB or smaller.';
      seen.add(file.name);
      return { file, error, result: null };
    });
    setFiles(next);
    setConfirmOverwrite(false);
  }

  async function upload() {
    if (!serviceId || validFiles.length === 0 || (hasCollisions && !confirmOverwrite)) return;
    setIsUploading(true);
    const token = await getToken();
    if (!token) {
      setFiles((current) =>
        current.map((entry) =>
          entry.error ? entry : { ...entry, error: 'Your session expired. Sign in again.' },
        ),
      );
      setIsUploading(false);
      return;
    }

    const results: UploadServiceDocResponse[] = [];
    const updated = [...files];
    for (let index = 0; index < updated.length; index += 1) {
      const entry = updated[index];
      if (entry.error) continue;
      try {
        const contentMd = await entry.file.text();
        if (!contentMd.trim()) throw new Error('Markdown files cannot be empty.');
        const result = await api.uploadServiceDoc(
          serviceId,
          {
            filename: entry.file.name,
            contentMd,
            overwrite: existingPaths.has(`manual/${entry.file.name}`),
          },
          token,
        );
        updated[index] = { ...entry, result };
        results.push(result);
      } catch (error) {
        updated[index] = {
          ...entry,
          error: error instanceof Error ? error.message : 'Upload failed.',
        };
      }
      setFiles([...updated]);
    }

    setIsUploading(false);
    if (results.length > 0) onUploaded(serviceId, results);
  }

  return (
    <>
      <div className="upload-docs-backdrop" onClick={isUploading ? undefined : onClose} />
      <dialog className="upload-docs-modal" open aria-modal="true" aria-label="Upload TechDocs">
        <header className="upload-docs-head">
          <div>
            <span className="upload-docs-kicker">Manual documentation</span>
            <h2>Upload Markdown</h2>
          </div>
          <button type="button" onClick={onClose} disabled={isUploading} aria-label="Close">
            ×
          </button>
        </header>

        <div className="upload-docs-body">
          <label className="upload-docs-field">
            <span>Service</span>
            <select
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setConfirmOverwrite(false);
              }}
              disabled={isUploading || finished}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.id})
                </option>
              ))}
            </select>
          </label>

          <input
            ref={fileInput}
            className="upload-docs-file-input"
            type="file"
            accept=".md,text/markdown"
            multiple
            onChange={(event) => selectFiles(event.target.files)}
          />
          <button
            className="upload-docs-picker"
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={isUploading || finished}
          >
            <strong>Choose .md files</strong>
            <span>Up to 1 MiB each · safe filenames only</span>
          </button>

          {files.length > 0 && (
            <ul className="upload-docs-files">
              {files.map(({ file, error, result }, index) => {
                const collision = !error && existingPaths.has(`manual/${file.name}`);
                return (
                  <li key={index} className={error ? 'error' : result ? 'success' : ''}>
                    <div>
                      <strong>{file.name}</strong>
                      <span>{formatBytes(file.size)}</span>
                    </div>
                    {error && <p role="alert">{error}</p>}
                    {!error && result && (
                      <p>{result.operation === 'updated' ? 'Updated' : 'Created'} successfully.</p>
                    )}
                    {!error && !result && collision && <p>Will replace the existing document.</p>}
                    {!error && !result && !collision && <p>Ready to create.</p>}
                  </li>
                );
              })}
            </ul>
          )}

          {hasCollisions && !finished && (
            <label className="upload-docs-confirm">
              <input
                type="checkbox"
                checked={confirmOverwrite}
                onChange={(event) => setConfirmOverwrite(event.target.checked)}
              />
              I understand that the marked documents will be replaced.
            </label>
          )}
        </div>

        <footer className="upload-docs-foot">
          <button
            type="button"
            className="upload-docs-secondary"
            onClick={onClose}
            disabled={isUploading}
          >
            {finished ? 'Done' : 'Cancel'}
          </button>
          {!finished && (
            <button
              type="button"
              className="upload-docs-primary"
              onClick={upload}
              disabled={
                isUploading ||
                !serviceId ||
                validFiles.length === 0 ||
                (hasCollisions && !confirmOverwrite)
              }
            >
              {isUploading ? 'Uploading…' : `Upload ${validFiles.length || ''}`}
            </button>
          )}
        </footer>
      </dialog>
    </>
  );
}

function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${Math.ceil(bytes / 1024)} KiB`;
}
