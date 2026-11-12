import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Service } from '@daleelex/shared';
import { ServiceCard } from '../components/ServiceCard';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { RegisterServiceModal } from '../components/RegisterServiceModal';
import { TopBarActions } from '../lib/topbar';
import { api } from '../api';
import './ServicesPage.css';

const TIERS = ['All', 'Tier 1', 'Tier 2', 'Tier 3'] as const;

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

  const services = data?.data ?? [];
  const search = params.get('q') ?? '';
  const tier = params.get('tier') ? `Tier ${params.get('tier')}` : 'All';
  const owner = params.get('owner') ?? 'All';
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
    setParams(new URLSearchParams());
  }

  return (
    <>
      <TopBarActions>
        <button className="register-btn" onClick={() => setRegistering(true)}>
          <PlusIcon />
          Register service
        </button>
      </TopBarActions>

      {notice && (
        <div className={`catalog-notice ${notice.kind}`} role="status">
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">
            <CloseIcon />
          </button>
        </div>
      )}

      <section className="filter-row">
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
        <div className="count-label">
          {isLoading ? '—' : `${filtered.length} of ${services.length} services`}
        </div>
      </section>

      <section className="grid">
        {isLoading && <div className="empty">Loading services…</div>}
        {isError && <div className="empty">Failed to load services. Check the API.</div>}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="empty">
            <strong>No services match these filters.</strong>
            <span>Try widening your search or clearing the active filters.</span>
            <button className="empty-action" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        )}
        {!isLoading &&
          !isError &&
          filtered.map((service) => (
            <ServiceCard key={service.id} service={service} onClick={() => setSelected(service)} />
          ))}
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
