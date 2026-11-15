export type Fetcher = typeof fetch;

export interface GitHubContext {
  token: string;
  apiUrl: string;
  fetcher: Fetcher;
}

/** GET a GitHub resource, by API path or by an absolute URL the API handed us. */
export async function githubJson<T>(ctx: GitHubContext, pathOrUrl: string): Promise<T> {
  const result = await request<T>(ctx, pathOrUrl, []);
  return result as T;
}

/** As githubJson, but a 404 is an answer ("not there") rather than a failure. */
export function githubJsonOrNull<T>(ctx: GitHubContext, pathOrUrl: string): Promise<T | null> {
  return request<T>(ctx, pathOrUrl, [404]);
}

/**
 * As githubJson, but each status in `refusals` is an answer ("GitHub will not
 * say") rather than a failure. For endpoints that refuse by design, such as
 * the 403 a repository with Dependabot alerts switched off gives.
 */
export function githubJsonUnlessRefused<T>(
  ctx: GitHubContext,
  pathOrUrl: string,
  refusals: readonly number[],
): Promise<T | null> {
  return request<T>(ctx, pathOrUrl, refusals);
}

async function request<T>(
  ctx: GitHubContext,
  pathOrUrl: string,
  nullOn: readonly number[],
): Promise<T | null> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${ctx.apiUrl}${pathOrUrl}`;
  const response = await ctx.fetcher(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${ctx.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  // A rate limit also arrives as a 403. It is an outage on our side, never an
  // answer, so it must fail even where a 403 would otherwise be accepted.
  const rateLimited =
    response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after');
  if (!rateLimited && nullOn.includes(response.status)) return null;
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
