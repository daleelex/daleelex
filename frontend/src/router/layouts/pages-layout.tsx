import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../../components/molecules/side-bar/side-bar';
import { TopNavBar } from '../../components/molecules/top-bar/top-bar';
import { ConnectionBanner } from '../../components/molecules/connection-banner/connection-banner';
import { useConnection } from '../../providers/connection-provider';
import { Route } from '../../configs/enums';
import './pages-layout.scss';

const PAGE_TITLES: Record<string, string> = {
  [Route.HOME]: '',
  [Route.SERVICES]: 'Catalog',
  [Route.TEAMS]: 'Teams',
  [Route.DOCS]: 'TechDocs',
  [Route.HEALTH]: 'Health & SLO',
  [Route.SETTINGS]: 'Settings',
};

const getPageTitle = (pathname: string): string => {
  if (PAGE_TITLES[pathname] !== undefined) return PAGE_TITLES[pathname];
  if (pathname.startsWith(`${Route.SERVICES}/`)) return 'Service Details';
  return 'DaleelEx';
};

export const PagesLayout: React.FC = () => {
  const location = useLocation();
  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  useConnection(); // keeps the connection tracker mounted; banner below reacts to it

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-layout__content">
        <TopNavBar pageTitle={pageTitle} />
        <div className="app-layout__topbar-spacer" aria-hidden="true" />
        <ConnectionBanner />
        <main className="app-layout__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};