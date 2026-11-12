import { assertRepository, githubJsonOrNull, type Fetcher, type GitHubContext } from './github.js';
import type { RepositoryProbe } from './checks/index.js';

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
}
