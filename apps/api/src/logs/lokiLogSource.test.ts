import { describe, expect, it, vi } from 'vitest';
import { InvalidLogCursorError, LogSourceUnavailableError, type LogQuery } from './logSource.js';
import { buildLogQL, LokiLogSource } from './lokiLogSource.js';

const baseQuery: LogQuery = {
  selector: { serviceId: 'svc-payments' },
  start: '2026-08-01T09:00:00.000Z',
  end: '2026-08-01T10:00:00.000Z',
  limit: 3,
};

const msToNs = (iso: string) => (BigInt(Date.parse(iso)) * 1_000_000n).toString();

type Stream = { stream: Record<string, string>; values: Array<[string, string]> };

/**
 * Just enough of query_range to keep the source honest: [start, end) range, newest
 * first, and `limit` applied across all streams — the behaviours pagination relies on.
 */
function fakeLoki(streams: Stream[]) {
  const calls: URLSearchParams[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request) => {
    const params = new URL(String(input)).searchParams;
    calls.push(params);
    const start = BigInt(params.get('start')!);
    const end = BigInt(params.get('end')!);
    const limit = Number(params.get('limit'));

    const matching = streams
      .flatMap(({ stream, values }) => values.map((value) => ({ stream, value })))
      .filter(({ value }) => BigInt(value[0]) >= start && BigInt(value[0]) < end)
      .sort((a, b) => (BigInt(b.value[0]) > BigInt(a.value[0]) ? 1 : -1))
      .slice(0, limit);

    const grouped = new Map<Record<string, string>, Array<[string, string]>>();
    for (const { stream, value } of matching) {
      grouped.set(stream, [...(grouped.get(stream) ?? []), value]);
    }

    return Response.json({
      status: 'success',
      data: {
        resultType: 'streams',
        result: [...grouped].map(([stream, values]) => ({ stream, values })),
      },
    });
  });
  return { fetchFn, calls };
}

function source(fetchFn: typeof fetch) {
  return new LokiLogSource({ baseUrl: 'http://loki:3100/', fetch: fetchFn });
}

describe('LokiLogSource', () => {
  it('maps streams to entries, newest first, with levels from labels', async () => {
    const { fetchFn, calls } = fakeLoki([
      {
        stream: { service_id: 'svc-payments', level: 'WARNING' },
        values: [[msToNs('2026-08-01T09:30:00.000Z'), 'slow upstream']],
      },
      {
        stream: { service_id: 'svc-payments', detected_level: 'error' },
        values: [[msToNs('2026-08-01T09:45:00.000Z'), 'payment failed']],
      },
    ]);

    const page = await source(fetchFn).query(baseQuery);

    expect(page.nextCursor).toBeNull();
    expect(page.entries.map((entry) => [entry.timestamp, entry.level, entry.message])).toEqual([
      ['2026-08-01T09:45:00.000Z', 'error', 'payment failed'],
      ['2026-08-01T09:30:00.000Z', 'warn', 'slow upstream'],
    ]);
    expect(page.entries[0].labels).toEqual({
      service_id: 'svc-payments',
      detected_level: 'error',
    });
    expect(calls[0].get('query')).toBe('{service_id="svc-payments"}');
    expect(calls[0].get('direction')).toBe('backward');
  });

  it('includes an entry exactly at the requested end', async () => {
    const { fetchFn } = fakeLoki([
      { stream: { service_id: 'svc-payments' }, values: [[msToNs(baseQuery.end), 'at the end']] },
    ]);

    const page = await source(fetchFn).query(baseQuery);

    expect(page.entries.map((entry) => entry.message)).toEqual(['at the end']);
  });

  it('pages without gaps or repeats, even when entries share a nanosecond', async () => {
    const shared = msToNs('2026-08-01T09:50:00.000Z');
    const { fetchFn } = fakeLoki([
      {
        stream: { service_id: 'svc-payments', instance: 'a' },
        values: [
          [msToNs('2026-08-01T09:55:00.000Z'), 'a-1'],
          [shared, 'a-2'],
          [shared, 'a-3'],
          [msToNs('2026-08-01T09:10:00.000Z'), 'a-4'],
        ],
      },
      {
        stream: { service_id: 'svc-payments', instance: 'b' },
        values: [
          [shared, 'b-1'],
          [shared, 'b-2'],
          [msToNs('2026-08-01T09:20:00.000Z'), 'b-3'],
        ],
      },
    ]);
    const loki = source(fetchFn);

    const messages: string[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < 10; pages += 1) {
      const page = await loki.query({ ...baseQuery, limit: 2, cursor });
      messages.push(...page.entries.map((entry) => entry.message));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(messages).toHaveLength(7);
    expect(new Set(messages).size).toBe(7);
    expect(messages[0]).toBe('a-1');
    expect(messages.slice(-2)).toEqual(['b-3', 'a-4']);
  });

  it('builds a case-insensitive, literal search filter', () => {
    expect(buildLogQL('service_id', 'svc-"x"', 'a.b "c"')).toBe(
      String.raw`{service_id="svc-\"x\""} |~ "(?i)a\\.b \"c\""`,
    );
  });

  it.each([
    ['service', { selector: { serviceId: 'svc-orders' } }],
    ['start', { start: '2026-08-01T09:01:00.000Z' }],
    ['end', { end: '2026-08-01T10:01:00.000Z' }],
    ['search', { search: 'retry' }],
  ])('rejects a cursor reused with different %s filters', async (_name, override) => {
    const { fetchFn } = fakeLoki([
      {
        stream: { service_id: 'svc-payments' },
        values: ['09:59', '09:58', '09:57', '09:56'].map((time) => [
          msToNs(`2026-08-01T${time}:00.000Z`),
          time,
        ]),
      },
    ]);
    const loki = source(fetchFn);
    const first = await loki.query(baseQuery);

    await expect(
      loki.query({ ...baseQuery, ...override, cursor: first.nextCursor! }),
    ).rejects.toBeInstanceOf(InvalidLogCursorError);
  });

  it('rejects malformed cursor values', async () => {
    const { fetchFn } = fakeLoki([]);
    await expect(
      source(fetchFn).query({ ...baseQuery, cursor: 'not-a-cursor' }),
    ).rejects.toBeInstanceOf(InvalidLogCursorError);
  });

  it('reports an unreachable or failing backend as unavailable', async () => {
    const unreachable = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(source(unreachable).query(baseQuery)).rejects.toBeInstanceOf(
      LogSourceUnavailableError,
    );

    const failing = vi.fn().mockResolvedValue(new Response('parse error', { status: 400 }));
    await expect(source(failing).query(baseQuery)).rejects.toThrow(
      'The log backend rejected the query (400: parse error).',
    );
  });
});
