import { CATALOG_FILE } from './catalogInfo.js';
import {
  assertOrg,
  assertRepository,
  githubJson,
  githubJsonOrNull,
  type Fetcher,
  type GitHubContext,
} from './github.js';

const PER_PAGE = 100;
// A runaway pagination loop against a huge org would burn the rate limit
// silently; 50 pages is 5,000 repositories, far past anything realistic.
const MAX_PAGES = 50;

interface GitHubRepo {
  full_name: string;
  archived: boolean;
}

interface GitHubContent {
  content: string;
  encoding: string;
  sha: string;
}

export interface CatalogFile {
  repository: string;
  source: string;
  /** Blob SHA of the file, so a later run can tell whether it changed. */
  sourceSha: string;
}

export class GitHubCatalogClient {
  private readonly ctx: GitHubContext;

  constructor(token: string, apiUrl = 'https://api.github.com', fetcher: Fetcher = fetch) {
    this.ctx = { token, apiUrl, fetcher };
  }

  /** Every non-archived repository in the org, as "owner/repo". */
  async listRepositories(org: string): Promise<string[]> {
    assertOrg(org);
    const repositories: string[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const batch = await githubJson<GitHubRepo[]>(
        this.ctx,
        `/orgs/${org}/repos?per_page=${PER_PAGE}&page=${page}&type=all`,
      );

      repositories.push(...batch.filter((repo) => !repo.archived).map((repo) => repo.full_name));
      if (batch.length < PER_PAGE) return repositories;
    }

    throw new Error(`Stopped listing ${org} after ${MAX_PAGES} pages; is the org that large?`);
  }

  /**
   * The repository's catalog-info.yaml, or null when it does not have one.
   * Reads the default branch unless `ref` names a branch, tag or commit.
   */
  async fetchCatalogFile(repository: string, ref?: string): Promise<CatalogFile | null> {
    assertRepository(repository);
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const content = await githubJsonOrNull<GitHubContent>(
      this.ctx,
      `/repos/${repository}/contents/${CATALOG_FILE}${query}`,
    );

    if (!content) return null;
    if (content.encoding !== 'base64') {
      throw new Error(`Unsupported encoding "${content.encoding}" for ${repository}.`);
    }

    return {
      repository,
      source: Buffer.from(content.content.replace(/\s/g, ''), 'base64').toString('utf8'),
      sourceSha: content.sha,
    };
  }
}
