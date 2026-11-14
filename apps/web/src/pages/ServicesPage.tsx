import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Service } from '@daleelex/shared';
import { ServiceCard } from '../components/ServiceCard';
import { ServiceTable } from '../components/ServiceTable';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { RegisterServiceModal } from '../components/RegisterServiceModal';
import { TopBarActions } from '../lib/topbar';
import { toServiceHealth, stateWeight, STATE_LABEL, type ServiceHealth } from '../lib/health';
import { api } from '../api';
import './ServicesPage.css';

const TIERS = ['All', 'Tier 1', 'Tier 2', 'Tier 3'] as const;

const SORTS = {
  name: 'Name',
  tier: 'Tier',
  health: 'Needs attention first',
  updated: 'Recently updated',
} as const;
type SortKey = keyof typeof SORTS;

const COMPARATORS: Record<SortKey, (a: ServiceHealth, b: ServiceHealth) => number> = {
  name: (a, b) => a.service.name.localeCompare(b.service.name),
  tier: (a, b) => a.service.tier - b.service.tier || COMPARATORS.name(a, b),
  health: (a, b) =>
    stateWeight(b.state) - stateWeight(a.state) || a.score - b.score || COMPARATORS.tier(a, b),
  updated: (a, b) => b.service.updatedAt.localeCompare(a.service.updatedAt),
};

type CatalogNotice = {
  kind: 'success' | 'error';
  message: string;
};

export function ServicesPage() {
  const [params, setParams] = useSearchParams();
  const [registering, setRegistering] = useState(false);
  const [notice, setNotice] = useState<CatalogNotice | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const services = useMemo(() => data?.data ?? [], [data]);
  const search = params.get('q') ?? '';
  const tier = params.get('tier') ? `Tier ${params.get('tier')}` : 'All';
  const owner = params.get('owner') ?? 'All';
  const sortParam = params.get('sort') ?? '';
  const sort: SortKey = sortParam in SORTS ? (sortParam as SortKey) : 'name';
  const view = params.get('view') === 'table' ? 'table' : 'grid';
  const activeFilters = [search.trim(), tier !== 'All', owner !== 'All'].filter(Boolean).length;

  // Selection lives in the URL so the command palette — and a pasted link —
  // can open a service drawer from anywhere in the app.
  const selected = services.find((s) => s.id === params.get('service')) ?? null;

  function setSelected(service: Service | null) {
    setParams((next) => {
      const updated = new URLSearchParams(next);
      if (service) updated.set('service', service.id);
      else updated.delete('service');
      return updated;
    });
  }

  const owners = useMemo(() => {
    const names = services.map((s) => s.owner?.name).filter((n): n is string => !!n);
    return ['All', ...Array.from(new Set(names)).sort()];
  }, [services]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return services.filter((s) => {
      const matchSearch =
        !normalizedSearch ||
        s.name.toLowerCase().includes(normalizedSearch) ||
        s.id.toLowerCase().includes(normalizedSearch) ||
        s.description?.toLowerCase().includes(normalizedSearch) ||
        s.tags.some((t) => t.toLowerCase().includes(normalizedSearch));
      const matchTier = tier === 'All' || s.tier === Number(tier.split(' ')[1]);
      const matchOwner = owner === 'All' || s.owner?.name === owner;
      return matchSearch && matchTier && matchOwner;
    });
  }, [services, search, tier, owner]);

  // Health is derived per service, so sorting by it means sorting the rows.
  const rows = useMemo(
    () => filtered.map(toServiceHealth).sort(COMPARATORS[sort]),
    [filtered, sort],
  );

  const summary = useMemo(() => {
    const counts = { healthy: 0, watch: 0, risk: 0 };
    for (const service of services) counts[toServiceHealth(service).state] += 1;
    return counts;
  }, [services]);

  // View and sort are preferences, not filters: they survive "Clear".
  function setPreference(key: 'sort' | 'view', value: string, fallback: string) {
    setParams(
      (next) => {
        const updated = new URLSearchParams(next);
        if (value === fallback) updated.delete(key);
        else updated.set(key, value);
        return updated;
      },
      { replace: true },
    );
  }

  function updateFilter(key: 'q' | 'tier' | 'owner', value: string) {
    setParams((next) => {
      const updated = new URLSearchParams(next);
      const emptyValue =
        !value.trim() ||
        (key === 'tier' && value === 'All') ||
        (key === 'owner' && value === 'All');

      if (emptyValue) {
        updated.delete(key);
      } else {
        updated.set(key, key === 'tier' ? value.split(' ')[1] : value);
      }

      return updated;
    });
  }

  function resetFilters() {
    setParams((next) => {
      const updated = new URLSearchParams(next);
      for (const key of ['q', 'tier', 'owner']) updated.delete(key);
      return updated;
    });
  }

  return (
    <>
      <TopBarActions>
        <button className="register-btn" onClick={() => setRegistering(true)}>
          <PlusIcon />
          Register service
        </button>
      </TopBarActions>

      <header className="catalog-head">
        <h1 className="catalog-title">Catalog</h1>
        {!isLoading && !isError && (
          <ul className="catalog-summary" aria-label="Catalog health">
            <li>
              <strong>{services.length}</strong> {services.length === 1 ? 'service' : 'services'}
            </li>
            {(['healthy', 'watch', 'risk'] as const).map((state) => (
              <li key={state}>
                <span className={`state-dot ${state}`} aria-hidden="true" />
                <strong>{summary[state]}</strong> {STATE_LABEL[state].toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </header>

      {notice && (
        <div className={`catalog-notice ${notice.kind}`} role="status">
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            <CloseIcon />
          </button>
        </div>
      )}

      <section className="filter-row" aria-label="Filters">
        <div className="filter-search">
          <label className="sr-only" htmlFor="service-search">
            Search services
          </label>
          <SearchIcon />
          <input
            id="service-search"
            type="search"
            placeholder="Filter by name, ID, tag…"
            value={search}
            onChange={(e) => updateFilter('q', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Tier</span>
          {TIERS.map((t) => (
            <button
              key={t}
              className={`chip${tier === t ? ' active' : ''}`}
              onClick={() => updateFilter('tier', t)}
              aria-pressed={tier === t}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Owner</span>
          <select
            className="filter-select"
            value={owner}
            onChange={(e) => updateFilter('owner', e.target.value)}
            aria-label="Filter by owner"
          >
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        {activeFilters > 0 && (
          <button className="reset-filters" onClick={resetFilters}>
            Clear {activeFilters}
          </button>
        )}

        <div className="filter-end">
          <div className="count-label">
            {isLoading ? '—' : `${rows.length} of ${services.length}`}
          </div>
          <select
            className="filter-select"
            value={sort}
            onChange={(e) => setPreference('sort', e.target.value, 'name')}
            aria-label="Sort services"
          >
            {Object.entries(SORTS).map(([key, label]) => (
              <option key={key} value={key}>
                Sort: {label}
              </option>
            ))}
          </select>
          <div className="view-toggle" role="group" aria-label="View">
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setPreference('view', 'grid', 'grid')}
              aria-pressed={view === 'grid'}
              aria-label="Grid view"
              title="Grid view"
            >
              <GridIcon />
            </button>
            <button
              className={view === 'table' ? 'active' : ''}
              onClick={() => setPreference('view', 'table', 'grid')}
              aria-pressed={view === 'table'}
              aria-label="Table view"
              title="Table view"
            >
              <RowsIcon />
            </button>
          </div>
        </div>
      </section>

      <section className="catalog-results">
        {isLoading && <div className="catalog-empty">Loading services…</div>}
        {isError && <div className="catalog-empty">Failed to load services. Check the API.</div>}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="catalog-empty">
            <strong>
              {services.length === 0
                ? 'No services registered yet.'
                : 'No services match these filters.'}
            </strong>
            {services.length > 0 && (
              <>
                <span>Try widening your search or clearing the active filters.</span>
                <button className="empty-action" onClick={resetFilters}>
                  Reset filters
                </button>
              </>
            )}
          </div>
        )}
        {!isLoading && !isError && rows.length > 0 && view === 'grid' && (
          <div className="catalog-grid">
            {rows.map((row) => (
              <ServiceCard
                key={row.service.id}
                health={row}
                onClick={() => setSelected(row.service)}
              />
            ))}
          </div>
        )}
        {!isLoading && !isError && rows.length > 0 && view === 'table' && (
          <ServiceTable rows={rows} onOpen={setSelected} />
        )}
      </section>

      <ServiceDrawer
        service={selected}
        onClose={() => setSelected(null)}
        onDeleteSuccess={(service) => {
          setNotice({ kind: 'success', message: `${service.name} was removed from the catalog.` });
        }}
        onUpdateSuccess={(service) => {
          setNotice({ kind: 'success', message: `${service.name} was updated.` });
        }}
      />
      {registering && <RegisterServiceModal onClose={() => setRegistering(false)} />}
    </>
  );
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ color: 'var(--muted)', flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
