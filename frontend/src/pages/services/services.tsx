import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { useServices } from './services.hooks';
import { ServiceCard } from '../../components/molecules/service-card/service-card';
import { ServiceDrawer } from '../../components/organisms/service-drawer/service-drawer';
import { RegisterServiceModal } from '../../components/organisms/register-service-modal/register-service-modal';
import type { Service } from '../../types/catalog.types';
import './services.scss';

export const ServicesPage: React.FC = () => {
    const { data, isLoading, error } = useServices();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Service | null>(null);
    const [showRegister, setShowRegister] = useState(false);

    const services = data?.data ?? [];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return services;
        return services.filter(
            (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || (s.language ?? '').toLowerCase().includes(q),
        );
    }, [services, search]);

    return (
        <div className="services-page">
            <header className="services-page__topbar">
                <div>
                    <h1 className="services-page__title">Catalog</h1>
                    <p className="services-page__subtitle">{services.length > 0 ? `${services.length} services` : 'No services'} registered</p>
                </div>
                <button className="btn-primary" onClick={() => setShowRegister(true)} type="button">
                    <Plus size={15} /> Register service
                </button>
            </header>

            <div className="services-search">
                <Search size={15} />
                <input type="text" placeholder="Search by name, ID, or language…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {error && <p className="empty-note">Failed to load services.</p>}

            <div className="services-grid">
                {isLoading
                    ? Array.from({ length: 6 }, (_, i) => <div key={i} className="service-card-skeleton" />)
                    : filtered.map((s) => <ServiceCard key={s.id} service={s} onClick={() => setSelected(s)} />)}
                {!isLoading && filtered.length === 0 && <p className="empty-note">No services match your search.</p>}
            </div>

            <ServiceDrawer service={selected} onClose={() => setSelected(null)} onDeleteSuccess={() => setSelected(null)} />
            {showRegister && <RegisterServiceModal onClose={() => setShowRegister(false)} />}
        </div>
    );
};