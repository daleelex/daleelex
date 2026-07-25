import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClerkProvider, Show, RedirectToSignIn } from '@clerk/react';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ServicesPage } from './pages/ServicesPage';
import { TeamsPage } from './pages/TeamsPage';
import { TechDocsPage } from './pages/TechDocsPage';
import { HealthPage } from './pages/HealthPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import './styles.css';

const queryClient = new QueryClient();

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set — check apps/web/.env');
}

const savedTheme = (localStorage.getItem('daleelex-theme') as 'light' | 'dark') ?? 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/login"
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/signup/*" element={<SignUpPage />} />
            <Route
              path="/"
              element={
                <Show when="signed-in" fallback={<RedirectToSignIn />}>
                  <Layout />
                </Show>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="teams" element={<TeamsPage />} />
              <Route path="docs" element={<TechDocsPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
);
