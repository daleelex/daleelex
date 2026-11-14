import { createHash } from 'node:crypto';
import type { LogLevel, ServiceLogEntry } from '@daleelex/shared';
import {
  InvalidLogCursorError,
  LogSourceUnavailableError,
  type LogPage,
  type LogQuery,
  type LogSource,
} from './logSource.js';

export interface LokiLogSourceOptions {
  /** e.g. http://loki:3100 — no trailing path. */
  baseUrl: string;
  /** The stream label that carries the catalog service ID. */
  serviceLabel?: string;
  fetch?: typeof fetch;
}

interface CursorScope {
  serviceId: string;
  start: string;
  end: string;
  search: string | null;
}

/**
 * Loki entries have no ID and can share a nanosecond timestamp, so "everything older
 * than the last entry" would drop siblings at the boundary. The cursor keeps the
 * boundary timestamp plus the IDs already returned at it; the next page re-includes
 * that nanosecond and skips those IDs.
 */
interface LokiCursor {
  version: 1;
  scope: CursorScope;
  before: {
    timestampNs: string;
    seenIds: string[];
  };
}

interface LokiQueryRangeResponse {
  status: string;
  data?: {
    resultType?: string;
    result?: Array<{ stream: Record<string, string>; values: Array<[string, string]> }>;
  };
}

interface LokiEntry extends ServiceLogEntry {
  timestampNs: bigint;
}

const LEVELS: Record<string, LogLevel> = {
  trace: 'trace',
  debug: 'debug',
  info: 'info',
  information: 'info',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  err: 'error',
  fatal: 'error',
  critical: 'error',
};

const REQUEST_TIMEOUT_MS = 10_000;

export class LokiLogSource implements LogSource {
  private readonly baseUrl: string;
  private readonly serviceLabel: string;
  private readonly fetch: typeof fetch;

  constructor(options: LokiLogSourceOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceLabel = options.serviceLabel ?? 'service_id';
    this.fetch = options.fetch ?? fetch;
  }

  async query(query: LogQuery): Promise<LogPage> {
    const scope = queryScope(query);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    if (cursor && !sameScope(cursor.scope, scope)) {
      throw new InvalidLogCursorError(
        'The log cursor belongs to a different service, time range, or search query.',
      );
    }

    const seen = new Set(cursor?.before.seenIds ?? []);
    // +1 ns because Loki's range end is exclusive and both the requested end and the
    // cursor boundary are meant inclusively.
    const endNs = (cursor ? BigInt(cursor.before.timestampNs) : isoToNs(query.end)) + 1n;
    // One spare entry to learn whether another page exists, plus room for the boundary
    // entries we are about to skip.
    const fetchLimit = query.limit + 1 + seen.size;

    const entries = (await this.queryRange(query, endNs, fetchLimit))
      .filter((entry) => !seen.has(entry.id))
      .sort(compareNewestFirst);

    const pageEntries = entries.slice(0, query.limit);
    const lastEntry = pageEntries.at(-1);
    const hasMore = entries.length > pageEntries.length;

    let nextCursor: string | null = null;
    if (hasMore && lastEntry) {
      const boundaryIds = pageEntries
        .filter((entry) => entry.timestampNs === lastEntry.timestampNs)
        .map((entry) => entry.id);
      // Still on the previous boundary nanosecond? Then the earlier skips still apply.
      if (cursor && BigInt(cursor.before.timestampNs) === lastEntry.timestampNs) {
        boundaryIds.push(...seen);
      }
      nextCursor = encodeCursor({
        version: 1,
        scope,
        before: { timestampNs: lastEntry.timestampNs.toString(), seenIds: boundaryIds },
      });
    }

    return {
      entries: pageEntries.map(({ timestampNs: _timestampNs, ...entry }) => entry),
      nextCursor,
    };
  }

  private async queryRange(query: LogQuery, endNs: bigint, limit: number): Promise<LokiEntry[]> {
    const params = new URLSearchParams({
      query: buildLogQL(this.serviceLabel, query.selector.serviceId, query.search),
      start: isoToNs(query.start).toString(),
      end: endNs.toString(),
      limit: String(limit),
      direction: 'backward',
    });

    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}/loki/api/v1/query_range?${params}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // A redirect is not followed; it surfaces below as a rejected query.
        redirect: 'manual',
      });
    } catch {
      throw new LogSourceUnavailableError('The log backend could not be reached.');
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).trim().slice(0, 200);
      throw new LogSourceUnavailableError(
        `The log backend rejected the query (${response.status}${detail ? `: ${detail}` : ''}).`,
      );
    }

    const body = (await response.json()) as LokiQueryRangeResponse;
    if (body.status !== 'success' || body.data?.resultType !== 'streams') {
      throw new LogSourceUnavailableError('The log backend returned an unexpected response.');
    }

    return (body.data.result ?? []).flatMap(({ stream, values }) =>
      values.map(([timestampNs, line]) => toEntry(stream, timestampNs, line)),
    );
  }
}

export function buildLogQL(serviceLabel: string, serviceId: string, search?: string) {
  const selector = `{${serviceLabel}=${logQLString(serviceId)}}`;
  if (!search) return selector;
  // Case-insensitive to match the mock's search semantics; the user's text is matched
  // literally, so regex metacharacters in it are escaped first.
  return `${selector} |~ ${logQLString(`(?i)${escapeRegExp(search)}`)}`;
}

function toEntry(stream: Record<string, string>, timestampNs: string, line: string): LokiEntry {
  const ns = BigInt(timestampNs);
  const id = createHash('sha256')
    .update(JSON.stringify([sortedLabels(stream), timestampNs, line]))
    .digest('hex')
    .slice(0, 20);

  return {
    id,
    timestampNs: ns,
    timestamp: new Date(Number(ns / 1_000_000n)).toISOString(),
    level: LEVELS[(stream.level ?? stream.detected_level ?? '').toLowerCase()] ?? 'info',
    message: line,
    labels: stream,
  };
}

function sortedLabels(stream: Record<string, string>) {
  return Object.keys(stream)
    .sort()
    .map((key) => [key, stream[key]]);
}

function compareNewestFirst(a: LokiEntry, b: LokiEntry) {
  if (a.timestampNs !== b.timestampNs) return a.timestampNs > b.timestampNs ? -1 : 1;
  return b.id.localeCompare(a.id);
}

function isoToNs(value: string) {
  return BigInt(Date.parse(value)) * 1_000_000n;
}

function logQLString(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function queryScope(query: LogQuery): CursorScope {
  return {
    serviceId: query.selector.serviceId,
    start: query.start,
    end: query.end,
    search: query.search ?? null,
  };
}

function sameScope(left: CursorScope, right: CursorScope) {
  return (
    left.serviceId === right.serviceId &&
    left.start === right.start &&
    left.end === right.end &&
    left.search === right.search
  );
}

function encodeCursor(cursor: LokiCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): LokiCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!isLokiCursor(parsed)) throw new Error('Unexpected cursor shape');
    return parsed;
  } catch {
    throw new InvalidLogCursorError();
  }
}

function isLokiCursor(value: unknown): value is LokiCursor {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as Partial<LokiCursor>;
  const scope = cursor.scope as Partial<CursorScope> | undefined;
  const before = cursor.before as Partial<LokiCursor['before']> | undefined;

  return (
    cursor.version === 1 &&
    typeof scope?.serviceId === 'string' &&
    typeof scope.start === 'string' &&
    typeof scope.end === 'string' &&
    (typeof scope.search === 'string' || scope.search === null) &&
    typeof before?.timestampNs === 'string' &&
    /^\d+$/.test(before.timestampNs) &&
    Array.isArray(before.seenIds) &&
    before.seenIds.every((id) => typeof id === 'string')
  );
}
