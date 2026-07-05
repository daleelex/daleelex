import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts
import { PagesLayout } from './layouts/pages-layout';

// Pages
import { HomePage } from '../pages/home/home';
import { ServicesPage } from '../pages/services/services';
import { TeamsPage } from '../pages/teams/teams';
import { TechDocsPage } from '../pages/documentation/documentation';
import { HealthPage } from '../pages/health/health';
import { SettingsPage } from '../pages/settings/settings';
import { NotFound } from '../pages/not-found/not-found';

import { Route as AppRoute } from '../configs/enums';
import { Login } from '../pages/login/login';

export const AppRouter: React.FC = () => (
  <Router>
    <ToastContainer position="top-right" />
    <Routes>
      {/* <Route element={<AuthLayout />}> */}
      <Route path="/login" element={<Login />} />
      {/* </Route> */}
      <Route element={<PagesLayout />}>
        <Route path={AppRoute.HOME} element={<HomePage />} />
        <Route path={AppRoute.SERVICES} element={<ServicesPage />} />
        <Route path={AppRoute.TEAMS} element={<TeamsPage />} />
        <Route path={AppRoute.DOCS} element={<TechDocsPage />} />
        <Route path={AppRoute.HEALTH} element={<HealthPage />} />
        <Route path={AppRoute.SETTINGS} element={<SettingsPage />} />
      </Route>

      {/* ── 404 ── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Router>
);