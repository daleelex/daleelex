import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ServiceCard } from '../components/ServiceCard';
import { api } from '../api';
import './ServicesPage.css';

export function ServicesPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const services = data?.data ?? [];
  const filtered = search.trim()
    ? services.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase()) ||
        s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : services;

  return (
    <div className="services-page">
      <div className="page-header">
        <h1 className="page-title">Services</h1>
        <span className="page-count">{filtered.length} of {services.length}</span>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="Search services..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading && <p className="state-message">Loading...</p>}
      {isError && <p className="state-message error">Failed to load services.</p>}

      {!isLoading && !isError && (
        <div className="services-grid">
          {filtered.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
          {filtered.length === 0 && (
            <p className="state-message">No services match "{search}".</p>
          )}
        </div>
      )}
    </div>
  );
}
