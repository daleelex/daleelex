import {
  assertRepository,
  githubJsonOrNull,
  githubJsonUnlessRefused,
  type Fetcher,
  type GitHubContext,
} from './github.js';
import type { RepositoryProbe, VulnerabilityAlerts } from './checks/index.js';

const ALERTS_PER_PAGE = 100;

export class GitHubRepositoryClient implements RepositoryProbe {
  private readonly ctx: GitHubContext;

  constructor(token: string, apiUrl = 'https://api.github.com', fetcher: Fetcher = fetch) {
    this.ctx = { token, apiUrl, fetcher };
  }

  /**
   * GitHub answers 404 both for a repository that does not exist and for one
   * the token may not see, so the two are indistinguishable here.
   */
  async exists(repository: string): Promise<boolean> {
    assertRepository(repository);
    return (await githubJsonOrNull<unknown>(this.ctx, `/repos/${repository}`)) !== null;
  }

  /** GitHub's own notion of a README: any casing or extension, in the usual places. */
  async hasReadme(repository: string): Promise<boolean> {
    assertRepository(repository);
    return (await githubJsonOrNull<unknown>(this.ctx, `/repos/${repository}/readme`)) !== null;
  }

  /**
   * Counts one page only. Past a hundred open high-severity alerts the exact
   * number changes nothing about the verdict, and paging would spend rate
   * limit on the repositories that least deserve it.
   *
   * 403 is alerts disabled or a token without the permission; 404 is a
   * repository the token cannot see; 400 is an archived repository.
   */
  async openVulnerabilityAlerts(repository: string): Promise<VulnerabilityAlerts | null> {
    assertRepository(repository);
    const alerts = await githubJsonUnlessRefused<unknown[]>(
      this.ctx,
      `/repos/${repository}/dependabot/alerts?state=open&severity=critical,high&per_page=${ALERTS_PER_PAGE}`,
      [400, 403, 404],
    );
    return alerts && { count: alerts.length, more: alerts.length === ALERTS_PER_PAGE };
  }
}
