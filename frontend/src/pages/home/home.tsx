import { Link } from 'react-router-dom';
import { useDashboardData } from './home.hooks';
import { KpiCard, SectionHeader } from './home.component';
import { ServiceCard } from '../../components/molecules/service-card/service-card';
import './home.scss';

export const HomePage: React.FC = () => {
  const { data, loading, error, refetch } = useDashboardData();

  return (
    <div className="home-page">
      <header className="home-page__topbar">
        <div>
          <h1 className="home-page__title">Service Catalog</h1>
          <p className="home-page__subtitle">Everything DaleelEx knows about your services and teams</p>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={refetch} type="button">Retry</button>
        </div>
      )}

      <section className="kpi-row" aria-label="Key metrics">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <div key={i} className="kpi-card kpi-card--skeleton" />)
        ) : (
          <>
            <KpiCard index={0} label="Services" value={data.stats.totalServices} sub="Registered in catalog" accent="teal" />
            <KpiCard index={1} label="Teams" value={data.stats.totalTeams} sub="Owning services" accent="royal" />
            <KpiCard index={2} label="Tier 1" value={data.stats.tier1Count} sub="Critical services" accent="navy" />
            <KpiCard index={3} label="Docs" value={data.stats.docsCount} sub="Indexed pages" accent="ocean" />
          </>
        )}
      </section>

      <SectionHeader title="Recently registered" action={<Link to="/services" className="section-header__link">View all</Link>} />
      <section className="home-grid">
        {data.recentServices.map((s) => <ServiceCard key={s.id} service={s} />)}
        {!loading && data.recentServices.length === 0 && <p className="empty-note">No services registered yet.</p>}
      </section>

      <SectionHeader title="Teams" action={<Link to="/teams" className="section-header__link">View all</Link>} />
      <section className="home-teams-row">
        {data.teams.map((t) => (
          <div key={t.id} className="home-team-chip">
            <span className="home-team-chip__name">{t.name}</span>
            <span className="home-team-chip__count">{t.serviceCount} services</span>
          </div>
        ))}
      </section>
    </div>
  );
};