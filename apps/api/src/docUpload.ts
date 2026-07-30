export const MAX_MARKDOWN_BYTES = 1024 * 1024;
export const MARKDOWN_FILENAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.md$/;

export function validateMarkdownUpload(filename: string, contentMd: string) {
  if (!MARKDOWN_FILENAME.test(filename)) {
    return 'Filename must start with a letter or number, contain only letters, numbers, dashes, or underscores, and end in .md.';
  }

  if (!contentMd.trim()) {
    return 'Markdown files cannot be empty.';
  }

  if (Buffer.byteLength(contentMd, 'utf8') > MAX_MARKDOWN_BYTES) {
    return 'Markdown files must be 1 MiB or smaller.';
  }

  return null;
}

export function manualDocPath(filename: string) {
  return `manual/${filename}`;
}

export function markdownTitle(contentMd: string, filename: string) {
  const heading = contentMd.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  if (heading) return heading;

  return filename
    .replace(/\.md$/i, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
