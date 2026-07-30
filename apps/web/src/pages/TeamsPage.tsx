import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TeamWithStats } from '@daleelex/shared';
import { TeamDrawer } from '../components/TeamDrawer';
import { UserAvatar } from '../components/UserAvatar';
import { api } from '../api';
import './TeamsPage.css';

export function TeamsPage() {
  const [selected, setSelected] = useState<TeamWithStats | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teams'],
    queryFn: api.teams,
  });

  const teams = data?.data ?? [];
  const totalServices = teams.reduce((sum, t) => sum + t.serviceCount, 0);
  const teamsWithHealth = teams.filter((team) => team.averageScorecardHealth !== null);
  const scoredServices = teamsWithHealth.reduce((sum, team) => sum + team.scoredServiceCount, 0);
  const catalogAverage =
    scoredServices > 0
      ? Math.round(
          teamsWithHealth.reduce(
            (sum, team) => sum + team.averageScorecardHealth! * team.scoredServiceCount,
            0,
          ) / scoredServices,
        )
      : null;

  return (
    <>
      <header className="topbar">
        <div className="crumb">
          <span>DaleelEx</span>
          <ChevronRight />
          <span className="current">Teams</span>
        </div>
        <div className="top-right">
          <UserAvatar />
        </div>
      </header>

      <section className="hero">
        <div className="crumb" style={{ fontSize: 11 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>ENGINEERING TEAMS</span>
        </div>
        <h1 className="page-title">
          The people behind <em>every service.</em>
        </h1>
        <p className="page-sub">
          See what every team owns, how its services score, and where ownership still needs
          attention.
        </p>
      </section>

      <section className="stats">
        <div className="stat-cell">
          <div className="stat-label">Total teams</div>
          <div className="stat-inner">
            <div className="stat-value">{isLoading ? '—' : teams.length}</div>
          </div>
          <div className="stat-sub">across the org</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Services owned</div>
          <div className="stat-inner">
            <div className="stat-value">{isLoading ? '—' : totalServices}</div>
          </div>
          <div className="stat-sub">active services</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Unowned services</div>
          <div className="stat-inner">
            <div className="stat-value">{isLoading ? '—' : (data?.unownedServiceCount ?? 0)}</div>
          </div>
          <div className="stat-sub">services without a team</div>
        </div>
        <div className="stat-cell accent">
          <div className="stat-label">Average health</div>
          <div className="stat-inner">
            <div className="stat-value">
              {isLoading ? '—' : catalogAverage === null ? 'N/A' : `${catalogAverage}%`}
            </div>
          </div>
          <div className="stat-sub">across scored teams</div>
        </div>
      </section>

      <section className="teams-grid">
        {isLoading && <div className="empty">Loading teams…</div>}
        {isError && <div className="empty">Failed to load teams. Check the API.</div>}
        {!isLoading &&
          !isError &&
          teams.map((team) => (
            <TeamCard key={team.id} team={team} onClick={() => setSelected(team)} />
          ))}
      </section>

      <footer className="foot">
        <span className="mono">DALEELEX v0.5 {new Date().getFullYear()}</span>
        <span>
          Teams sourced from <code>catalog-info.yaml</code>
        </span>
      </footer>

      <TeamDrawer team={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function TeamCard({ team, onClick }: { team: TeamWithStats; onClick?: () => void }) {
  const visibleServices = team.services.slice(0, 4);

  return (
    <article
      className="team-card"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="team-card-head">
        <div className="team-avatar">{initials(team.name)}</div>
        <div className="team-head-text">
          <h3 className="team-name">{team.name}</h3>
          <div className="team-id">{team.id}</div>
        </div>
      </div>

      <div className="team-meta">
        {team.slackChannel && (
          <div className="team-meta-row">
            <SlackIcon />
            <span>{team.slackChannel}</span>
          </div>
        )}
        {team.onCallSchedule ? (
          <div className="team-meta-row">
            <PagerIcon />
            <span>{team.onCallSchedule}</span>
          </div>
        ) : (
          <div className="team-meta-row muted">
            <PagerIcon />
            <span>No on-call schedule</span>
          </div>
        )}
      </div>

      <div className="team-health-row">
        <div>
          <div className="team-services-label">Average scorecard health</div>
          <strong>
            {team.averageScorecardHealth === null
              ? 'Not scored'
              : `${team.averageScorecardHealth}%`}
          </strong>
          <span>
            {team.scoredServiceCount} of {team.serviceCount} services
          </span>
        </div>
        <div
          className={`team-gap-count${team.openOwnershipGaps.length > 0 ? ' open' : ''}`}
          aria-label={`${team.openOwnershipGaps.length} open ownership gaps`}
        >
          <strong>{team.openOwnershipGaps.length}</strong>
          <span>ownership gaps</span>
        </div>
      </div>

      <div className="team-tier-row">
        {team.tier1Count > 0 && <span className="tier-pill tier-1">T1 · {team.tier1Count}</span>}
        {team.tier2Count > 0 && <span className="tier-pill tier-2">T2 · {team.tier2Count}</span>}
        {team.tier3Count > 0 && <span className="tier-pill tier-3">T3 · {team.tier3Count}</span>}
        {team.serviceCount === 0 && <span className="tier-pill tier-3">No services</span>}
      </div>

      {visibleServices.length > 0 && (
        <div className="team-services">
          <div className="team-services-label">Services</div>
          {visibleServices.map((s) => (
            <div key={s.id} className="team-service-row">
              <span className={`service-tier-dot tier-dot-${s.tier}`} />
              <span className="service-name">{s.name}</span>
              <span className="team-service-score">
                {s.scorecardHealth === null ? '—' : `${s.scorecardHealth}%`}
              </span>
            </div>
          ))}
          {team.serviceCount > visibleServices.length && (
            <div className="team-service-more">
              +{team.serviceCount - visibleServices.length} more
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function ChevronRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
      <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
      <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" />
      <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" />
    </svg>
  );
}

function PagerIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l1-1a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
