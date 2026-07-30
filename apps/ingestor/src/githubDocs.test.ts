import { describe, expect, it, vi } from 'vitest';
import { GitHubDocsClient, markdownTitle } from './githubDocs.js';

describe('GitHubDocsClient', () => {
  it('fetches docs markdown at a stable commit and ignores non-doc files', async () => {
    const fetcher = vi
      .fn<[input: RequestInfo | URL, init?: RequestInit], Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({ sha: 'commit-123', commit: { tree: { sha: 'tree-123' } } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', url: 'https://api.github.test/readme' },
            { path: 'docs/setup.md', type: 'blob', url: 'https://api.github.test/setup' },
            { path: 'docs/diagram.png', type: 'blob', url: 'https://api.github.test/image' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          encoding: 'base64',
          content: Buffer.from('# Set up\n\nHello.').toString('base64'),
        }),
      );

    const result = await new GitHubDocsClient(
      'token',
      'https://api.github.test',
      fetcher,
    ).fetchDocs('acme/payments');

    expect(result).toEqual({
      repository: 'acme/payments',
      sourceSha: 'commit-123',
      docs: [{ path: 'docs/setup.md', title: 'Set up', contentMd: '# Set up\n\nHello.' }],
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('rejects truncated trees so missing files are not deleted', async () => {
    const fetcher = vi
      .fn<[input: RequestInfo | URL, init?: RequestInit], Promise<Response>>()
      .mockResolvedValueOnce(
        jsonResponse({ sha: 'commit-123', commit: { tree: { sha: 'tree-123' } } }),
      )
      .mockResolvedValueOnce(jsonResponse({ truncated: true, tree: [] }));

    await expect(
      new GitHubDocsClient('token', 'https://api.github.test', fetcher).fetchDocs('acme/payments'),
    ).rejects.toThrow('truncated');
  });
});

describe('markdownTitle', () => {
  it('uses the first level-one heading or a readable filename', () => {
    expect(markdownTitle('Intro\n# API Guide\n', 'docs/api.md')).toBe('API Guide');
    expect(markdownTitle('No heading', 'docs/getting-started.md')).toBe('Getting Started');
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
