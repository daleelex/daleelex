import { useState } from 'react';
import { useTeams } from './teams.hooks';
import { TeamDrawer } from '../../components/organisms/team-drawer/team-drawer';
import type { TeamWithStats } from '../../types/catalog.types';
import './teams.scss';

function initials(name: string) {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export const TeamsPage: React.FC = () => {
    const { data, isLoading, error } = useTeams();
    const [selected, setSelected] = useState<TeamWithStats | null>(null);
    const teams = data?.data ?? [];

    return (
        <div className="teams-page">
            <header className="teams-page__topbar">
                <h1 className="teams-page__title">Teams</h1>
                <p className="teams-page__subtitle">{teams.length > 0 ? `${teams.length} teams` : 'No teams'} own services in the catalog</p>
            </header>

            {error && <p className="empty-note">Failed to load teams.</p>}

            <div className="teams-grid">
                {isLoading
                    ? Array.from({ length: 6 }, (_, i) => <div key={i} className="team-card-skeleton" />)
                    : teams.map((t) => (
                        <button key={t.id} className="team-card" onClick={() => setSelected(t)} type="button">
                            <span className="team-card__avatar">{initials(t.name)}</span>
                            <span className="team-card__name">{t.name}</span>
                            <span className="team-card__meta">{t.serviceCount} services · {t.tier1Count} tier 1</span>
                        </button>
                    ))}
                {!isLoading && teams.length === 0 && <p className="empty-note">No teams registered yet.</p>}
            </div>

            <TeamDrawer team={selected} onClose={() => setSelected(null)} />
        </div>
    );
};