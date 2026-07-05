import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { JenkinsTestResponse } from '../../types/jenkins.types';
import { JenkinsApi } from '../../services/jenkins.service';
import './settings.scss';

export function SettingsPage() {
    return (
        <div className="settings-page">
            <header className="settings-topbar">
                <div>
                    <div className="settings-kicker">Administration</div>
                    <h1 className="settings-title">Settings</h1>
                </div>
            </header>

            <div className="settings-body">
                <nav className="settings-nav">
                    <div className="settings-nav-section">Integrations</div>
                    <a className="settings-nav-item active" href="#jenkins">Jenkins</a>
                </nav>

                <div className="settings-content">
                    <JenkinsSection />
                </div>
            </div>
        </div>
    );
}

function JenkinsSection() {
    const queryClient = useQueryClient();
    const { data: config, isLoading } = useQuery({
        queryKey: ['integrations', 'jenkins', 'config'],
        queryFn: JenkinsApi.getConfig,
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
        mutationFn: () => JenkinsApi.testConnection({ baseUrl, username: username || undefined, token: token || undefined }),
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
        mutationFn: () => JenkinsApi.saveConfig({ baseUrl, username: username || undefined, token: token || undefined }),
        onSuccess: () => {
            setToken('');
            queryClient.invalidateQueries({ queryKey: ['integrations', 'jenkins'] });
        },
    });

    const dirty = baseUrl !== (config?.baseUrl ?? '') || username !== (config?.username ?? '') || token !== '';
    const missingRequiredCredentials = !username.trim() || (!config?.tokenSet && !token.trim());

    if (isLoading) {
        return <div className="settings-loading">Loading configuration...</div>;
    }

    return (
        <section className="settings-section" id="jenkins">
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
                        onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); }}
                    />
                    <p className="form-hint">The root URL of your Jenkins instance, without a trailing slash.</p>
                </div>

                <div className="form-row">
                    <label htmlFor="jenkins-username">Username</label>
                    <input
                        id="jenkins-username"
                        type="text"
                        placeholder="your-jenkins-username"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setTestResult(null); }}
                    />
                </div>

                <div className="form-row">
                    <label htmlFor="jenkins-token">
                        API Token
                        {config?.tokenSet && token === '' && (
                            <span className="token-set-indicator">Token saved — enter a new one to replace it</span>
                        )}
                    </label>
                    <input
                        id="jenkins-token"
                        type="password"
                        placeholder={config?.tokenSet ? '••••••••' : 'Paste your Jenkins API token'}
                        value={token}
                        onChange={(e) => { setToken(e.target.value); setTestResult(null); }}
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
                        {testResult.version && <span className="test-version">Jenkins {testResult.version}</span>}
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
                        disabled={!baseUrl.trim() || missingRequiredCredentials || !dirty || saveMutation.isPending}
                    >
                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </section>
    );
}

function JenkinsLogo() {
    return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#335061" />
            <path d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 2a8 8 0 1 1 0 16A8 8 0 0 1 16 8zm-1 3v6l5 3-1 1.732-6-3.464V11h2z" fill="#D9E8EE" />
        </svg>
    );
}