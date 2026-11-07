export type Fetcher = typeof fetch;

export interface GitHubContext {
  token: string;
  apiUrl: string;
  fetcher: Fetcher;
}

/** GET a GitHub resource, by API path or by an absolute URL the API handed us. */
export async function githubJson<T>(ctx: GitHubContext, pathOrUrl: string): Promise<T> {
  const result = await request<T>(ctx, pathOrUrl, false);
  return result as T;
}

/** As githubJson, but a 404 is an answer ("not there") rather than a failure. */
export function githubJsonOrNull<T>(ctx: GitHubContext, pathOrUrl: string): Promise<T | null> {
  return request<T>(ctx, pathOrUrl, true);
}

async function request<T>(
  ctx: GitHubContext,
  pathOrUrl: string,
  allowNotFound: boolean,
): Promise<T | null> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${ctx.apiUrl}${pathOrUrl}`;
  const response = await ctx.fetcher(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${ctx.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${url}.`);
  }

  return response.json() as Promise<T>;
}

export function assertRepository(repository: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`Invalid GitHub repository "${repository}". Expected "owner/repo".`);
  }
}

export function assertOrg(org: string) {
  if (!/^[A-Za-z0-9_.-]+$/.test(org)) {
    throw new Error(`Invalid GitHub organisation "${org}".`);
  }
}
