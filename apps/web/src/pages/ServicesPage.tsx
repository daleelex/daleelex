import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Service } from '@daleelex/shared';
import { ServiceCard } from '../components/ServiceCard';
import { api } from '../api';
import './ServicesPage.css';

const TIERS = ['All', 'Tier 1', 'Tier 2', 'Tier 3'] as const;

export function ServicesPage() {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<string>('All');
  const [owner, setOwner] = useState<string>('All');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const services = data?.data ?? [];

  const owners = useMemo(() => {
    const names = services
      .map((s) => s.owner?.name)
      .filter((n): n is string => !!n);
    return ['All', ...Array.from(new Set(names)).sort()];
  }, [services]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase()) ||
        s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchTier =
        tier === 'All' || s.tier === Number(tier.split(' ')[1]);
      const matchOwner =
        owner === 'All' || s.owner?.name === owner;
      return matchSearch && matchTier && matchOwner;
    });
  }, [services, search, tier, owner]);

  const stats = useMemo(() => computeStats(services), [services]);

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
            <SearchIcon />
            <input
              type="search"
              placeholder="Search services…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="kbd">K</kbd>
          </div>
          <button className="icon-btn" title="Notifications">
            <BellIcon />
          </button>
          <div className="avatar">NA</div>
        </div>
      </header>

      <section className="hero">
        <div className="crumb" style={{ fontSize: 11 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>SOFTWARE CATALOGUE</span>
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
              onClick={() => setTier(t)}
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
            onChange={(e) => setOwner(e.target.value)}
          >
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
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
          <div className="empty">No services match these filters. Try widening your search.</div>
        )}
        {!isLoading && !isError && filtered.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </section>

      <footer className="foot">
        <span className="mono">DALEELEX v0.5 {new Date().getFullYear()}</span>
        <span>Built on <code>catalog-info.yaml</code></span>
      </footer>
    </>
  );
}

function computeStats(services: Service[]) {
  const total = services.length;
  const tier1 = services.filter((s) => s.tier === 1).length;
  const production = services.filter((s) => s.lifecycle === 'production').length;
  const teams = new Set(services.map((s) => s.ownerTeamId).filter(Boolean)).size;
  return [
    { label: 'Total services', value: total, sub: 'across all teams', accent: false },
    { label: 'Tier 1 critical', value: tier1, sub: 'require SLO ≥ 99.9%', accent: false },
    { label: 'In production', value: production, sub: `${total - production} beta / deprecated`, accent: false },
    { label: 'Teams', value: teams, sub: 'owning services', accent: true },
  ];
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
