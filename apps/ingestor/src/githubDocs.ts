import { assertRepository, githubJson, type Fetcher, type GitHubContext } from './github.js';

export interface RepositoryDoc {
  path: string;
  title: string;
  contentMd: string;
}

interface GitHubCommit {
  sha: string;
  commit: { tree: { sha: string } };
}

interface GitHubTree {
  truncated: boolean;
  tree: {
    path: string;
    type: 'blob' | 'tree';
    url: string;
  }[];
}

interface GitHubBlob {
  content: string;
  encoding: string;
}

export class GitHubDocsClient {
  private readonly ctx: GitHubContext;

  constructor(token: string, apiUrl = 'https://api.github.com', fetcher: Fetcher = fetch) {
    this.ctx = { token, apiUrl, fetcher };
  }

  async fetchDocs(repository: string, ref = 'HEAD') {
    assertRepository(repository);
    const commit = await githubJson<GitHubCommit>(
      this.ctx,
      `/repos/${repository}/commits/${encodeURIComponent(ref)}`,
    );
    const tree = await githubJson<GitHubTree>(
      this.ctx,
      `/repos/${repository}/git/trees/${commit.commit.tree.sha}?recursive=1`,
    );

    if (tree.truncated) {
      throw new Error(`Git tree for ${repository} was truncated; refusing a partial docs sync.`);
    }

    const blobs = tree.tree.filter(
      (entry) =>
        entry.type === 'blob' &&
        entry.path.startsWith('docs/') &&
        entry.path.toLowerCase().endsWith('.md'),
    );

    const docs = await mapWithConcurrency(blobs, 8, async (entry): Promise<RepositoryDoc> => {
      const blob = await githubJson<GitHubBlob>(this.ctx, entry.url);
      if (blob.encoding !== 'base64') {
        throw new Error(`Unsupported GitHub blob encoding "${blob.encoding}" for ${entry.path}.`);
      }
      const contentMd = Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8');
      return {
        path: entry.path,
        title: markdownTitle(contentMd, entry.path),
        contentMd,
      };
    });

    return {
      repository,
      sourceSha: commit.sha,
      docs: docs.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }
}

export function markdownTitle(contentMd: string, path: string) {
  const heading = contentMd.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  if (heading) return heading;

  const filename = path.split('/').pop()?.replace(/\.md$/i, '') ?? path;
  return filename
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

// Docs-heavy repos can hold hundreds of markdown blobs; fetching them all at
// once trips GitHub's secondary rate limits.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}
