import { describe, expect, it } from 'vitest';
import type { ServiceDoc } from '@daleelex/shared';
import { resolveDocUrl } from './docLinks';

const doc: ServiceDoc = {
  id: 1,
  path: 'docs/guides/setup.md',
  title: 'Setup',
  contentMd: '',
  sourceRepository: 'acme/payments',
  sourceSha: 'abc123',
  uploadedByUserId: null,
  updatedByUserId: null,
  fetchedAt: '2026-07-30T00:00:00Z',
};

describe('resolveDocUrl', () => {
  it('resolves links and images relative to the source document revision', () => {
    expect(resolveDocUrl('../api.md#auth', doc, 'link')).toBe(
      'https://github.com/acme/payments/blob/abc123/docs/api.md#auth',
    );
    expect(resolveDocUrl('../assets/flow diagram.png', doc, 'image')).toBe(
      'https://raw.githubusercontent.com/acme/payments/abc123/docs/assets/flow%20diagram.png',
    );
  });

  it('leaves absolute, anchor, and unsafe escaping paths unchanged', () => {
    expect(resolveDocUrl('https://example.com', doc, 'link')).toBe('https://example.com');
    expect(resolveDocUrl('#overview', doc, 'link')).toBe('#overview');
    expect(resolveDocUrl('../../../secret.md', doc, 'link')).toBe('../../../secret.md');
  });
});
