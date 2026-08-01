import { createHash } from 'node:crypto';
import type { LogLevel, ServiceLogEntry } from '@daleelex/shared';
import { InvalidLogCursorError, type LogPage, type LogQuery, type LogSource } from './logSource.js';

interface CursorScope {
  serviceId: string;
  start: string;
  end: string;
  search: string | null;
}

interface MockCursor {
  version: 1;
  scope: CursorScope;
  after: {
    timestamp: string;
    id: string;
  };
}

const LEVELS: LogLevel[] = ['info', 'debug', 'info', 'info', 'warn', 'info', 'error', 'debug'];

const MESSAGE_TEMPLATES = [
  'HTTP request completed with status 200',
  'Cache lookup completed successfully',
  'Health check passed',
  'Background job processed 24 records',
  'Upstream request exceeded the warning threshold',
  'Database query completed',
  'Request failed after retry budget was exhausted',
  'Configuration snapshot refreshed',
];

export class MockLogSource implements LogSource {
  async query(query: LogQuery): Promise<LogPage> {
    const scope = queryScope(query);
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    if (cursor && !sameScope(cursor.scope, scope)) {
      throw new InvalidLogCursorError(
        'The log cursor belongs to a different service, time range, or search query.',
      );
    }

    const search = query.search?.toLocaleLowerCase();
    const entries = generateEntries(query)
      .filter((entry) => !search || entry.message.toLocaleLowerCase().includes(search))
      .filter((entry) => !cursor || comesAfterCursor(entry, cursor.after));

    const pageEntries = entries.slice(0, query.limit);
    const hasMore = entries.length > pageEntries.length;
    const lastEntry = pageEntries.at(-1);

    return {
      entries: pageEntries,
      nextCursor:
        hasMore && lastEntry
          ? encodeCursor({
              version: 1,
              scope,
              after: { timestamp: lastEntry.timestamp, id: lastEntry.id },
            })
          : null,
    };
  }
}

function generateEntries(query: LogQuery): ServiceLogEntry[] {
  const startMs = Date.parse(query.start);
  const endMs = Date.parse(query.end);
  const intervalMs = Math.max(1, Math.floor((endMs - startMs) / 160));
  const entries: ServiceLogEntry[] = [];

  for (let index = 0; index < 160; index += 1) {
    const timestampMs = endMs - index * intervalMs;
    if (timestampMs < startMs) break;

    const timestamp = new Date(timestampMs).toISOString();
    const templateIndex = seededIndex(query.selector.serviceId, index, MESSAGE_TEMPLATES.length);
    const levelIndex = seededIndex(query.selector.serviceId, index, LEVELS.length);
    const id = createHash('sha256')
      .update(`${query.selector.serviceId}:${timestamp}:${index}`)
      .digest('hex')
      .slice(0, 20);

    entries.push({
      id,
      timestamp,
      level: LEVELS[levelIndex],
      message: `${MESSAGE_TEMPLATES[templateIndex]} · ${query.selector.serviceId}`,
      labels: {
        service_id: query.selector.serviceId,
        environment: 'production',
        instance: `${query.selector.serviceId}-${(index % 3) + 1}`,
      },
    });
  }

  return entries.sort(compareNewestFirst);
}

function seededIndex(serviceId: string, index: number, length: number) {
  let seed = index;
  for (const character of serviceId) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  return seed % length;
}

function compareNewestFirst(a: ServiceLogEntry, b: ServiceLogEntry) {
  return b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id);
}

function comesAfterCursor(
  entry: ServiceLogEntry,
  after: { timestamp: string; id: string },
): boolean {
  return (
    entry.timestamp < after.timestamp ||
    (entry.timestamp === after.timestamp && entry.id < after.id)
  );
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

function encodeCursor(cursor: MockCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): MockCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (!isMockCursor(parsed)) throw new Error('Unexpected cursor shape');
    return parsed;
  } catch {
    throw new InvalidLogCursorError();
  }
}

function isMockCursor(value: unknown): value is MockCursor {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as Partial<MockCursor>;
  const scope = cursor.scope as Partial<CursorScope> | undefined;
  const after = cursor.after as Partial<MockCursor['after']> | undefined;

  return (
    cursor.version === 1 &&
    typeof scope?.serviceId === 'string' &&
    typeof scope.start === 'string' &&
    typeof scope.end === 'string' &&
    (typeof scope.search === 'string' || scope.search === null) &&
    typeof after?.timestamp === 'string' &&
    typeof after.id === 'string'
  );
}
