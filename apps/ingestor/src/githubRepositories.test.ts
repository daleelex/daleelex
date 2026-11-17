import { describe, expect, it, vi } from 'vitest';
import { GitHubRepositoryClient } from './githubRepositories.js';

type Fetcher = ReturnType<typeof vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>>;

describe('GitHubRepositoryClient.hasReadme', () => {
  it('asks GitHub for the README rather than guessing a filename', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(jsonResponse({ name: 'README.rst' }));

    await expect(client(fetcher).hasReadme('acme/payments')).resolves.toBe(true);
    expect(String(fetcher.mock.calls[0][0])).toBe(
      'https://api.github.test/repos/acme/payments/readme',
    );
  });

  it('reports a repository without one', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 }));

    await expect(client(fetcher).hasReadme('acme/payments')).resolves.toBe(false);
  });
});

describe('GitHubRepositoryClient.openVulnerabilityAlerts', () => {
  it('counts open high and critical alerts only', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(jsonResponse([{}, {}]));

    await expect(client(fetcher).openVulnerabilityAlerts('acme/payments')).resolves.toEqual({
      count: 2,
      more: false,
    });
    const url = String(fetcher.mock.calls[0][0]);
    expect(url).toContain('/repos/acme/payments/dependabot/alerts');
    expect(url).toContain('state=open');
    expect(url).toContain('severity=critical,high');
  });

  it('says there are more when the page comes back full', async () => {
    const fetcher: Fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(Array.from({ length: 100 }, () => ({}))));

    await expect(client(fetcher).openVulnerabilityAlerts('acme/payments')).resolves.toEqual({
      count: 100,
      more: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403, 404])('treats a %i as "GitHub will not say"', async (status) => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status }));

    await expect(client(fetcher).openVulnerabilityAlerts('acme/payments')).resolves.toBeNull();
  });

  it('fails on a rate-limit 403 instead of reading it as alerts being disabled', async () => {
    const fetcher: Fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
      );

    await expect(client(fetcher).openVulnerabilityAlerts('acme/payments')).rejects.toThrow('(403)');
  });

  it('still fails loudly on a real error', async () => {
    const fetcher: Fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 500 }));

    await expect(client(fetcher).openVulnerabilityAlerts('acme/payments')).rejects.toThrow('(500)');
  });
});

function client(fetcher: Fetcher) {
  return new GitHubRepositoryClient('token', 'https://api.github.test', fetcher);
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
