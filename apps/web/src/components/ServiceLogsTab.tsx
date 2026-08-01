import { type FormEvent, useMemo, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ServiceLogEntry } from '@daleelex/shared';
import { api } from '../api';
import './ServiceLogsTab.css';

const RANGE_OPTIONS = [
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '6 hours', value: 6 * 60 * 60 * 1000 },
  { label: '24 hours', value: 24 * 60 * 60 * 1000 },
] as const;

const DEFAULT_RANGE = RANGE_OPTIONS[1].value;

export function ServiceLogsTab({ serviceId }: { serviceId: string }) {
  const { getToken } = useAuth();
  const [rangeMs, setRangeMs] = useState<number>(DEFAULT_RANGE);
  const [windowEnd, setWindowEnd] = useState(() => new Date());
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState<string | undefined>();

  const range = useMemo(() => {
    const end = windowEnd.toISOString();
    const start = new Date(windowEnd.getTime() - rangeMs).toISOString();
    return { start, end };
  }, [rangeMs, windowEnd]);

  const query = useInfiniteQuery({
    queryKey: ['service-logs', serviceId, range.start, range.end, search ?? null],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const token = await getToken();
      if (!token) throw new Error('Your session is unavailable. Please sign in again.');

      return api.serviceLogs(
        serviceId,
        {
          ...range,
          search,
          cursor: pageParam,
          limit: 50,
        },
        token,
      );
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const entries = query.data?.pages.flatMap((page) => page.data) ?? [];

  function updateRange(nextRange: number) {
    setRangeMs(nextRange);
    setWindowEnd(new Date());
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim() || undefined);
    setWindowEnd(new Date());
  }

  return (
    <section className="service-logs" aria-label="Service logs">
      <div className="service-logs-toolbar">
        <label className="service-logs-range">
          <span>Time range</span>
          <select value={rangeMs} onChange={(event) => updateRange(Number(event.target.value))}>
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Last {option.label}
              </option>
            ))}
          </select>
        </label>

        <form className="service-logs-search" onSubmit={applySearch}>
          <label className="sr-only" htmlFor={`log-search-${serviceId}`}>
            Search log messages
          </label>
          <input
            id={`log-search-${serviceId}`}
            type="search"
            value={searchInput}
            placeholder="Search messages"
            maxLength={200}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="service-logs-window">
        <span>{formatWindow(range.start)}</span>
        <span aria-hidden="true">→</span>
        <span>{formatWindow(range.end)}</span>
        <span className="service-logs-order">Newest first</span>
      </div>

      {query.isPending ? (
        <div className="service-logs-state" role="status">
          Loading logs…
        </div>
      ) : query.isError ? (
        <div className="service-logs-state error" role="alert">
          <span>{query.error.message}</span>
          <button type="button" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="service-logs-state">
          No logs matched this time range{search ? ` and “${search}”` : ''}.
        </div>
      ) : (
        <>
          <div className="service-log-list" role="list" aria-label="Log entries">
            {entries.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>

          {query.hasNextPage && (
            <button
              className="service-logs-more"
              type="button"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? 'Loading older logs…' : 'Load older logs'}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function LogRow({ entry }: { entry: ServiceLogEntry }) {
  const visibleLabels = Object.entries(entry.labels).filter(([key]) => key !== 'service_id');

  return (
    <article className="service-log-row" role="listitem">
      <div className="service-log-meta">
        <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
        <span className={`service-log-level ${entry.level}`}>{entry.level}</span>
      </div>
      <div className="service-log-message">{entry.message}</div>
      {visibleLabels.length > 0 && (
        <div className="service-log-labels" aria-label="Log labels">
          {visibleLabels.map(([key, value]) => (
            <span key={key}>
              {key}={value}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function formatTimestamp(timestamp: string) {
  return timestamp.replace('T', ' ').replace('Z', ' UTC');
}

function formatWindow(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(timestamp));
}
