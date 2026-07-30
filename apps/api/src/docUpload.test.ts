import { describe, expect, it } from 'vitest';
import {
  manualDocPath,
  markdownTitle,
  MAX_MARKDOWN_BYTES,
  validateMarkdownUpload,
} from './docUpload.js';

describe('validateMarkdownUpload', () => {
  it('accepts safe Markdown filenames and content', () => {
    expect(validateMarkdownUpload('getting-started_2.md', '# Start')).toBeNull();
  });

  it.each(['../secret.md', 'nested/doc.md', '.hidden.md', 'notes.txt', 'with space.md'])(
    'rejects unsafe filename %s',
    (filename) => {
      expect(validateMarkdownUpload(filename, '# Content')).toMatch(/Filename/);
    },
  );

  it('rejects empty and oversized files', () => {
    expect(validateMarkdownUpload('empty.md', '  ')).toMatch(/empty/);
    expect(validateMarkdownUpload('large.md', 'a'.repeat(MAX_MARKDOWN_BYTES + 1))).toMatch(/1 MiB/);
  });
});

describe('manual document metadata', () => {
  it('isolates uploads from repository-synced paths', () => {
    expect(manualDocPath('runbook.md')).toBe('manual/runbook.md');
  });

  it('uses the first h1 or a humanized filename as the title', () => {
    expect(markdownTitle('# Deployment Guide\n\nText', 'fallback.md')).toBe('Deployment Guide');
    expect(markdownTitle('No heading', 'getting_started.md')).toBe('Getting Started');
  });
});
