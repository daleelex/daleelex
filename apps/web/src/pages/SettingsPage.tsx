import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth, useUser } from '@clerk/react';
import type { JenkinsTestResponse, LokiTestResponse } from '@daleelex/shared';
import { api } from '../api';
import { useTheme } from '../lib/theme';
import './SettingsPage.css';

const NAV_GROUPS = [
  {
    section: 'Account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'appearance', label: 'Appearance' },
    ],
  },
  {
    section: 'Integrations',
    items: [
      { id: 'jenkins', label: 'Jenkins' },
      { id: 'loki', label: 'Loki' },
    ],
  },
];

export function SettingsPage() {
  const [active, setActive] = useState('profile');

  return (
    <>
      <header className="settings-topbar">
        <div>
          <div className="settings-kicker">Administration</div>
          <h1 className="settings-title">Settings</h1>
        </div>
      </header>

      <div className="settings-body">
        <nav className="settings-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.section} className="settings-nav-group">
              <div className="settings-nav-section">{group.section}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-nav-item${active === item.id ? ' active' : ''}`}
                  onClick={() => setActive(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          {active === 'profile' && <ProfileSection />}
          {active === 'appearance' && <AppearanceSection />}
          {active === 'jenkins' && <JenkinsSection />}
          {active === 'loki' && <LokiSection />}
        </div>
      </div>
    </>
  );
}

function ProfileSection() {
  const { getToken } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return api.me(token);
    },
  });

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <div>
          <h2>Profile</h2>
          <p>Your account details, synced from your sign-in provider.</p>
        </div>
      </div>

      {isLoading && <div className="settings-loading">Loading profile...</div>}
      {isError && <div className="settings-loading">Failed to load profile.</div>}
      {data && (
        <div className="profile-card">
          {data.avatarUrl ? (
            <img className="profile-avatar" src={data.avatarUrl} alt="" />
          ) : (
            <div className="profile-avatar profile-avatar-fallback">
              {(data.name ?? data.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="profile-fields">
            <div className="profile-field">
              <span>Name</span>
              <strong>{data.name ?? 'Not set'}</strong>
            </div>
            <div className="profile-field">
              <span>Email</span>
              <strong>{data.email}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useTheme();

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <div>
          <h2>Appearance</h2>
          <p>Choose how DaleelEx looks on this device.</p>
        </div>
      </div>

      <div className="theme-options">
        <button
          type="button"
          className={`theme-option${theme === 'light' ? ' active' : ''}`}
          onClick={() => setTheme('light')}
        >
          <SunIcon />
          Light
        </button>
        <button
          type="button"
          className={`theme-option${theme === 'dark' ? ' active' : ''}`}
          onClick={() => setTheme('dark')}
        >
          <MoonIcon />
          Dark
        </button>
      </div>
    </section>
  );
}

function JenkinsSection() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery({
    queryKey: ['integrations', 'jenkins', 'config'],
    queryFn: api.jenkinsConfig,
  });

  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [testResult, setTestResult] = useState<JenkinsTestResponse | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!config || initialized) return;
    setBaseUrl(config.baseUrl ?? '');
    setUsername(config.username ?? '');
    setInitialized(true);
  }, [config, initialized]);

  const testMutation = useMutation({
    mutationFn: () =>
      api.testJenkinsConnection({
        baseUrl,
        username: username || undefined,
        token: token || undefined,
      }),
    onSuccess: (result) => {
      setTestResult(result);
      setTestError(null);
    },
    onError: (err: Error) => {
      setTestError(err.message);
      setTestResult(null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      api.saveJenkinsConfig({
        baseUrl,
        username: username || undefined,
        token: token || undefined,
      }),
    onSuccess: () => {
      setToken('');
      queryClient.invalidateQueries({ queryKey: ['integrations', 'jenkins'] });
    },
  });

  const dirty =
    baseUrl !== (config?.baseUrl ?? '') || username !== (config?.username ?? '') || token !== '';
  const missingRequiredCredentials = !username.trim() || (!config?.tokenSet && !token.trim());

  if (isLoading) {
    return <div className="settings-loading">Loading configuration...</div>;
  }

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <JenkinsLogo />
        <div>
          <h2>Jenkins</h2>
          <p>Connect to your Jenkins instance to surface CI build status in the portal.</p>
        </div>
        <div className="integration-badge">
          {config?.source === 'db' ? (
            <span className="badge-connected">Connected</span>
          ) : config?.source === 'env' ? (
            <span className="badge-env">Via env vars</span>
          ) : (
            <span className="badge-none">Not configured</span>
          )}
        </div>
      </div>

      <div className="settings-form">
        <div className="form-row">
          <label htmlFor="jenkins-url">Jenkins URL</label>
          <input
            id="jenkins-url"
            type="url"
            placeholder="http://jenkins.internal:8080"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              setTestResult(null);
            }}
          />
          <p className="form-hint">
            The root URL of your Jenkins instance, without a trailing slash.
          </p>
        </div>

        <div className="form-row">
          <label htmlFor="jenkins-username">Username</label>
          <input
            id="jenkins-username"
            type="text"
            placeholder="your-jenkins-username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setTestResult(null);
            }}
          />
        </div>

        <div className="form-row">
          <label htmlFor="jenkins-token">
            API Token
            {config?.tokenSet && token === '' && (
              <span className="token-set-indicator">
                Token saved — enter a new one to replace it
              </span>
            )}
          </label>
          <input
            id="jenkins-token"
            type="password"
            placeholder={config?.tokenSet ? '••••••••' : 'Paste your Jenkins API token'}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTestResult(null);
            }}
            autoComplete="new-password"
          />
          <p className="form-hint">
            Generate one in Jenkins under <em>User → Configure → API Token</em>. Stored encrypted.
          </p>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            <strong>{testResult.ok ? 'Connection successful' : 'Connection failed'}</strong>
            <span>{testResult.message}</span>
            {testResult.version && (
              <span className="test-version">Jenkins {testResult.version}</span>
            )}
          </div>
        )}
        {testError && (
          <div className="test-result fail">
            <strong>Error</strong>
            <span>{testError}</span>
          </div>
        )}
        {saveMutation.isSuccess && (
          <div className="test-result ok">
            <strong>Saved</strong>
            <span>Jenkins connection updated.</span>
          </div>
        )}
        {saveMutation.isError && (
          <div className="test-result fail">
            <strong>Save failed</strong>
            <span>{(saveMutation.error as Error).message}</span>
          </div>
        )}

        <div className="form-actions">
          <button
            className="btn-secondary"
            onClick={() => testMutation.mutate()}
            disabled={!baseUrl.trim() || testMutation.isPending}
          >
            {testMutation.isPending ? 'Testing...' : 'Test connection'}
          </button>
          <button
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={
              !baseUrl.trim() || missingRequiredCredentials || !dirty || saveMutation.isPending
            }
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </section>
  );
}

const DEFAULT_LOKI_LABEL = 'service_id';

function LokiSection() {
  const { user, isLoaded } = useUser();
  const isAdmin = user?.publicMetadata.role === 'admin';

  if (!isLoaded) {
    return <div className="settings-loading">Loading configuration...</div>;
  }

  return (
    <section className="settings-section">
      {isAdmin ? (
        <LokiForm />
      ) : (
        <>
          <LokiHead />
          <div className="settings-loading">Only administrators can configure the log backend.</div>
        </>
      )}
    </section>
  );
}

function LokiHead({ badge }: { badge?: ReactNode }) {
  return (
    <div className="settings-section-head">
      <LokiLogo />
      <div>
        <h2>Loki</h2>
        <p>Connect a Grafana Loki instance to show real logs in each service&apos;s Logs tab.</p>
      </div>
      {badge && <div className="integration-badge">{badge}</div>}
    </div>
  );
}

function LokiForm() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const withToken = async <T,>(call: (token: string) => Promise<T>) => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return call(token);
  };

  const {
    data: config,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['integrations', 'loki', 'config'],
    queryFn: () => withToken(api.lokiConfig),
  });

  const [baseUrl, setBaseUrl] = useState('');
  const [serviceLabel, setServiceLabel] = useState(DEFAULT_LOKI_LABEL);
  const [testResult, setTestResult] = useState<LokiTestResponse | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!config || initialized) return;
    setBaseUrl(config.baseUrl ?? '');
    setServiceLabel(config.serviceLabel);
    setInitialized(true);
  }, [config, initialized]);

  const body = () => ({ baseUrl, serviceLabel: serviceLabel.trim() || undefined });

  const testMutation = useMutation({
    mutationFn: () => withToken((token) => api.testLokiConnection(body(), token)),
    onSuccess: setTestResult,
    onError: () => setTestResult(null),
  });

  const onSaved = () => {
    // Logs already on screen came from the previous backend.
    queryClient.invalidateQueries({ queryKey: ['integrations', 'loki'] });
    queryClient.invalidateQueries({ queryKey: ['service-logs'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => withToken((token) => api.saveLokiConfig(body(), token)),
    onSuccess: () => {
      disconnectMutation.reset();
      onSaved();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => withToken(api.deleteLokiConfig),
    onSuccess: (next) => {
      saveMutation.reset();
      setTestResult(null);
      setBaseUrl(next.baseUrl ?? '');
      setServiceLabel(next.serviceLabel);
      onSaved();
    },
  });

  if (isLoading) {
    return <div className="settings-loading">Loading configuration...</div>;
  }
  if (isError || !config) {
    return (
      <>
        <LokiHead />
        <div className="test-result fail">
          <strong>Could not load the Loki configuration</strong>
          <span>{(error as Error | null)?.message ?? 'Unknown error.'}</span>
        </div>
      </>
    );
  }

  const dirty = baseUrl !== (config.baseUrl ?? '') || serviceLabel !== config.serviceLabel;
  const busy = testMutation.isPending || saveMutation.isPending || disconnectMutation.isPending;
  const clearFeedback = () => {
    setTestResult(null);
    testMutation.reset();
    saveMutation.reset();
    disconnectMutation.reset();
  };

  return (
    <>
      <LokiHead
        badge={
          config.source === 'db' ? (
            <span className="badge-connected">Connected</span>
          ) : config.source === 'env' ? (
            <span className="badge-env">Via env vars</span>
          ) : (
            <span className="badge-none">Not configured</span>
          )
        }
      />

      {config.source === 'none' && (
        <p className="integration-note">
          No Loki is connected, so the Logs tab is showing generated sample lines, not real logs.
        </p>
      )}
      {config.source === 'env' && (
        <p className="integration-note">
          Using <code>LOKI_URL</code> from the server environment. Saving here overrides it.
        </p>
      )}

      <div className="settings-form">
        <div className="form-row">
          <label htmlFor="loki-url">Loki URL</label>
          <input
            id="loki-url"
            type="url"
            placeholder="http://loki.internal:3100"
            value={baseUrl}
            onChange={(e) => {
              setBaseUrl(e.target.value);
              clearFeedback();
            }}
          />
          <p className="form-hint">
            The root URL of your Loki, reachable from the DaleelEx API server. Authentication is not
            supported yet.
          </p>
        </div>

        <div className="form-row">
          <label htmlFor="loki-label">Service label</label>
          <input
            id="loki-label"
            type="text"
            placeholder={DEFAULT_LOKI_LABEL}
            value={serviceLabel}
            onChange={(e) => {
              setServiceLabel(e.target.value);
              clearFeedback();
            }}
          />
          <p className="form-hint">
            The stream label whose value is the catalog service ID, e.g.{' '}
            <em>{`{${serviceLabel.trim() || DEFAULT_LOKI_LABEL}="svc-auth-001"}`}</em>.
          </p>
        </div>

        {testResult && (
          <div
            className={`test-result ${
              !testResult.ok ? 'fail' : testResult.labelFound === false ? 'warn' : 'ok'
            }`}
          >
            <strong>{testResult.ok ? 'Connection successful' : 'Connection failed'}</strong>
            <span>{testResult.message}</span>
          </div>
        )}
        {testMutation.isError && (
          <div className="test-result fail">
            <strong>Error</strong>
            <span>{(testMutation.error as Error).message}</span>
          </div>
        )}
        {saveMutation.isSuccess && (
          <div className="test-result ok">
            <strong>Saved</strong>
            <span>The Logs tab now reads from this Loki.</span>
          </div>
        )}
        {saveMutation.isError && (
          <div className="test-result fail">
            <strong>Save failed</strong>
            <span>{(saveMutation.error as Error).message}</span>
          </div>
        )}
        {disconnectMutation.isSuccess && (
          <div className="test-result ok">
            <strong>Disconnected</strong>
            <span>
              {config.source === 'env'
                ? 'The Logs tab is back on the Loki from the server environment.'
                : 'The Logs tab is back on sample lines.'}
            </span>
          </div>
        )}
        {disconnectMutation.isError && (
          <div className="test-result fail">
            <strong>Disconnect failed</strong>
            <span>{(disconnectMutation.error as Error).message}</span>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => testMutation.mutate()}
            disabled={!baseUrl.trim() || busy}
          >
            {testMutation.isPending ? 'Testing...' : 'Test connection'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={!baseUrl.trim() || !dirty || busy}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          {config.source === 'db' && (
            <button
              type="button"
              className="btn-secondary btn-disconnect"
              onClick={() => disconnectMutation.mutate()}
              disabled={busy}
            >
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function LokiLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#2B2118" />
      <path
        d="M9 10h14M9 14h10M9 18h14M9 22h7"
        stroke="#F5A623"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function JenkinsLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#335061" />
      <path
        d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 16 8zm-1 3v6l5 3-1 1.732-6-3.464V11h2z"
        fill="#D9E8EE"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
