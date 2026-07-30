import type { ServiceDoc } from '@daleelex/shared';

export function resolveDocUrl(url: string | undefined, doc: ServiceDoc, kind: 'link' | 'image') {
  if (!url || isAbsoluteUrl(url) || url.startsWith('#')) return url;
  if (!doc.sourceRepository || !doc.sourceSha) return url;

  const suffixIndex = url.search(/[?#]/);
  const relativePath = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : url.slice(suffixIndex);
  const baseSegments = url.startsWith('/') ? [] : doc.path.split('/').slice(0, -1);
  const resolvedSegments = normalizeSegments([...baseSegments, ...relativePath.split('/')]);
  if (!resolvedSegments) return url;

  const encodedPath = resolvedSegments.map(encodeURIComponent).join('/');
  const repository = doc.sourceRepository.split('/').map(encodeURIComponent).join('/');
  const sha = encodeURIComponent(doc.sourceSha);
  const base =
    kind === 'image'
      ? `https://raw.githubusercontent.com/${repository}/${sha}`
      : `https://github.com/${repository}/blob/${sha}`;

  return `${base}/${encodedPath}${suffix}`;
}

function normalizeSegments(segments: string[]) {
  const normalized: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (normalized.length === 0) return null;
      normalized.pop();
    } else {
      normalized.push(segment);
    }
  }
  return normalized;
}

function isAbsoluteUrl(url: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//');
}
