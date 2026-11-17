import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { TopBarSlotProvider } from '../lib/topbar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: <HomeIcon />, countKey: null, end: true },
  { to: '/services', label: 'Catalog', icon: <CatalogIcon />, countKey: 'services', end: false },
  {
    to: '/dependencies',
    label: 'Dependencies',
    icon: <GraphIcon />,
    countKey: null,
    end: false,
  },
  { to: '/teams', label: 'Teams', icon: <TeamsIcon />, countKey: 'teams', end: false },
  { to: '/docs', label: 'TechDocs', icon: <DocsIcon />, countKey: 'docs', end: false },
  { to: '/health', label: 'Readiness', icon: <HealthIcon />, countKey: null, end: false },
] as const;

export function Layout() {
  // Desktop: the sidebar is either full width or an icon rail — it never
  // disappears, so navigation is always one click away.
  const [expanded, setExpanded] = useState<boolean>(() => {
    return localStorage.getItem('daleelex-sidebar-open') !== 'false';
  });
  // Narrow screens: the sidebar is an off-canvas drawer instead.
  const [mobileOpen, setMobileOpen] = useState(false);

  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { pathname } = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (event.key === 'Escape') {
        setMobileOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { getToken } = useAuth();
  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return api.me(token);
    },
  });

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
  });

  const navCounts: Record<'services' | 'teams' | 'docs', number | null> = {
    services: statsQuery.data?.serviceCount ?? null,
    teams: statsQuery.data?.teamCount ?? null,
    docs: statsQuery.data?.docCount ?? null,
  };

  function toggleExpanded() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('daleelex-sidebar-open', String(next));
      return next;
    });
  }

  const sidebarClass = `sidebar${expanded ? '' : ' rail'}${mobileOpen ? ' mobile-open' : ''}`;

  return (
    <div className="root">
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <aside className={sidebarClass} aria-label="Primary">
        <NavLink to="/" className="brand" aria-label="DaleelEx home">
          <img
            className="brand-logo"
            src="/logo-on-dark.png"
            alt="DaleelEx"
            width="133"
            height="46"
          />
          <img className="brand-mark" src="/logo-mark.png" alt="" width="36" height="36" />
        </NavLink>

        <nav className="nav">
          {NAV_ITEMS.map((item) => {
            const count = item.countKey === null ? null : navCounts[item.countKey];

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={expanded ? undefined : item.label}
                aria-label={item.label}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                {item.icon}
                <span className="label">{item.label}</span>
                {count !== null && <span className="nav-count">{count}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <NavLink
            to="/settings"
            title={expanded ? undefined : 'Settings'}
            aria-label="Settings"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <SettingsIcon />
            <span className="label">Settings</span>
          </NavLink>
          <button
            className="nav-item sidebar-collapse"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <CollapseIcon flipped={!expanded} />
            <span className="label">Collapse</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <TopBar
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenNav={() => setMobileOpen(true)}
          actionsRef={setActionsSlot}
        />
        <TopBarSlotProvider value={actionsSlot}>
          <Outlet />
        </TopBarSlotProvider>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function CollapseIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      style={{ transform: flipped ? 'scaleX(-1)' : undefined, flexShrink: 0 }}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <polyline points="16 9 13 12 16 15" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function CatalogIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L18 10.54V7l-4-2" />
      <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l-4 2" />
    </svg>
  );
}
function TeamsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function GraphIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="2" y="9" width="6" height="6" rx="1.5" />
      <rect x="16" y="3" width="6" height="6" rx="1.5" />
      <rect x="16" y="15" width="6" height="6" rx="1.5" />
      <path d="M8 12h3a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h1M13 14v2a2 2 0 0 0 2 2h1" />
    </svg>
  );
}
function HealthIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
