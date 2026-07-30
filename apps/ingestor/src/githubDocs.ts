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
  constructor(
    private readonly token: string,
    private readonly apiUrl = 'https://api.github.com',
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async fetchDocs(repository: string, ref = 'HEAD') {
    assertRepository(repository);
    const commit = await this.get<GitHubCommit>(
      `/repos/${repository}/commits/${encodeURIComponent(ref)}`,
    );
    const tree = await this.get<GitHubTree>(
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

    const docs = await Promise.all(
      blobs.map(async (entry): Promise<RepositoryDoc> => {
        const blob = await this.get<GitHubBlob>(entry.url);
        if (blob.encoding !== 'base64') {
          throw new Error(`Unsupported GitHub blob encoding "${blob.encoding}" for ${entry.path}.`);
        }
        const contentMd = Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8');
        return {
          path: entry.path,
          title: markdownTitle(contentMd, entry.path),
          contentMd,
        };
      }),
    );

    return {
      repository,
      sourceSha: commit.sha,
      docs: docs.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }

  private async get<T>(pathOrUrl: string): Promise<T> {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${this.apiUrl}${pathOrUrl}`;
    const response = await this.fetcher(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub request failed (${response.status}) for ${url}.`);
    }

    return response.json() as Promise<T>;
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

function assertRepository(repository: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`Invalid GitHub repository "${repository}". Expected "owner/repo".`);
  }
}
