import { describe, expect, it, vi } from 'vitest';
import { GitHubCatalogClient } from './githubCatalog.js';

type Fetcher = ReturnType<typeof vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>>;

describe('GitHubCatalogClient.listRepositories', () => {
  it('walks every page and leaves archived repositories out', async () => {
    const fetcher: Fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page(100, 'acme/svc')))
      .mockResolvedValueOnce(
        jsonResponse([
          { full_name: 'acme/late', archived: false },
          { full_name: 'acme/retired', archived: true },
        ]),
      );

    const repositories = await client(fetcher).listRepositories('acme');

    expect(repositories).toHaveLength(101);
    expect(repositories).toContain('acme/late');
    expect(repositories).not.toContain('acme/retired');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toContain('page=2');
  });

  it('refuses an organisation name that is not one', async () => {
    const fetcher: Fetcher = vi.fn();

    await expect(client(fetcher).listRepositories('acme/evil')).rejects.toThrow('Invalid GitHub');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('GitHubCatalogClient.fetchCatalogFile', () => {
  it('decodes the file and keeps its blob sha', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        encoding: 'base64',
        content: Buffer.from('kind: Service\n').toString('base64'),
        sha: 'blob-123',
      }),
    );

    await expect(client(fetcher).fetchCatalogFile('acme/payments')).resolves.toEqual({
      repository: 'acme/payments',
      source: 'kind: Service\n',
      sourceSha: 'blob-123',
    });
    expect(String(fetcher.mock.calls[0][0])).toContain('/contents/catalog-info.yaml');
  });

  it('treats a missing file as "not registered", not as a failure', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(client(fetcher).fetchCatalogFile('acme/plain')).resolves.toBeNull();
  });

  it('still fails loudly on a real error', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(client(fetcher).fetchCatalogFile('acme/payments')).rejects.toThrow('(500)');
  });
});

function client(fetcher: Fetcher) {
  return new GitHubCatalogClient('token', 'https://api.github.test', fetcher);
}

function page(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    full_name: `${prefix}-${index}`,
    archived: false,
  }));
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
