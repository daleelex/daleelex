import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { Service } from '@daleelex/shared';
import { ServiceCard } from '../components/ServiceCard';
import { ServiceDrawer } from '../components/ServiceDrawer';
import { RegisterServiceModal } from '../components/RegisterServiceModal';
import { api } from '../api';
import './ServicesPage.css';

const TIERS = ['All', 'Tier 1', 'Tier 2', 'Tier 3'] as const;

export function ServicesPage() {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Service | null>(null);
  const [registering, setRegistering] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const services = data?.data ?? [];
  const search = params.get('q') ?? '';
  const tier = params.get('tier') ? `Tier ${params.get('tier')}` : 'All';
  const owner = params.get('owner') ?? 'All';
  const activeFilters = [search.trim(), tier !== 'All', owner !== 'All'].filter(Boolean).length;

  const owners = useMemo(() => {
    const names = services
      .map((s) => s.owner?.name)
      .filter((n): n is string => !!n);
    return ['All', ...Array.from(new Set(names)).sort()];
  }, [services]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return services.filter((s) => {
      const matchSearch =
        !normalizedSearch ||
        s.name.toLowerCase().includes(normalizedSearch) ||
        s.id.toLowerCase().includes(normalizedSearch) ||
        s.description?.toLowerCase().includes(normalizedSearch) ||
        s.tags.some((t) => t.toLowerCase().includes(normalizedSearch));
      const matchTier =
        tier === 'All' || s.tier === Number(tier.split(' ')[1]);
      const matchOwner =
        owner === 'All' || s.owner?.name === owner;
      return matchSearch && matchTier && matchOwner;
    });
  }, [services, search, tier, owner]);

  const stats = useMemo(() => computeStats(services), [services]);

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
      <header className="topbar">
        <div className="crumb">
          <span>DaleelEx</span>
          <ChevronRight />
          <span className="current">Catalog</span>
        </div>
        <div className="top-right">
          <div className="search">
            <label className="sr-only" htmlFor="service-search">Search services</label>
            <SearchIcon />
            <input
              ref={searchRef}
              id="service-search"
              type="search"
              placeholder="Search by name, ID, tag..."
              value={search}
              onChange={(e) => updateFilter('q', e.target.value)}
            />
            <kbd className="kbd">⌘K</kbd>
          </div>
          <button className="register-btn" onClick={() => setRegistering(true)}>
            <PlusIcon />
            Register service
          </button>
          <button className="icon-btn" title="Notifications">
            <BellIcon />
          </button>
          <div className="avatar">NA</div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-kicker">
          <span>Software catalogue</span>
        </div>
        <h1 className="page-title">
          Every service you ship, <em>in one place.</em>
        </h1>
        <p className="page-sub">
          Browse, track, and own the systems that run your business. From authentication
          to payments, ownership is clear, health is visible, and documentation stays
          one click away.
        </p>
      </section>

      <section className="stats">
        {stats.map((cell, i) => (
          <div key={i} className={`stat-cell${cell.accent ? ' accent' : ''}`}>
            <div className="stat-label">{cell.label}</div>
            <div className="stat-inner">
              <div className="stat-value">{cell.value}</div>
            </div>
            <div className="stat-sub">{cell.sub}</div>
          </div>
        ))}
      </section>

      <section className="filter-row">
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
              <option key={o} value={o}>{o}</option>
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
        {isLoading && (
          <div className="empty">Loading services…</div>
        )}
        {isError && (
          <div className="empty">Failed to load services. Check the API.</div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="empty">
            <strong>No services match these filters.</strong>
            <span>Try widening your search or clearing the active filters.</span>
            <button className="empty-action" onClick={resetFilters}>Reset filters</button>
          </div>
        )}
        {!isLoading && !isError && filtered.map((service) => (
          <ServiceCard key={service.id} service={service} onClick={() => setSelected(service)} />
        ))}
      </section>

      <footer className="foot">
        <span className="mono">DALEELEX v0.5 {new Date().getFullYear()}</span>
        <span>Built on <code>catalog-info.yaml</code></span>
      </footer>

      <ServiceDrawer service={selected} onClose={() => setSelected(null)} />
      {registering && <RegisterServiceModal onClose={() => setRegistering(false)} />}
    </>
  );
}

function computeStats(services: Service[]) {
  const total = services.length;
  const tier1 = services.filter((s) => s.tier === 1).length;
  const production = services.filter((s) => s.lifecycle === 'production').length;
  const teams = new Set(services.map((s) => s.ownerTeamId).filter(Boolean)).size;
  const prodPercent = total > 0 ? Math.round((production / total) * 100) : 0;
  return [
    { label: 'Total services', value: total, sub: 'across all teams', accent: false },
    { label: 'Tier 1 critical', value: tier1, sub: 'require SLO ≥ 99.9%', accent: false },
    { label: 'In production', value: production, sub: `${prodPercent}% of catalog`, accent: false },
    { label: 'Teams', value: teams, sub: 'owning services', accent: true },
  ];
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)', flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}
