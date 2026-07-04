import { useEffect, useState } from 'react';
import { useJenkinsConfig, useJenkinsMutations } from './settings.hooks';
import './settings.scss';

export const SettingsPage: React.FC = () => {
    const { data: config } = useJenkinsConfig();
    const { save, test } = useJenkinsMutations();

    const [baseUrl, setBaseUrl] = useState('');
    const [username, setUsername] = useState('');
    const [token, setToken] = useState('');

    useEffect(() => {
        if (config) {
            setBaseUrl(config.baseUrl ?? '');
            setUsername(config.username ?? '');
        }
    }, [config]);

    const payload = { baseUrl, username: username || undefined, token: token || undefined };

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        save.mutate(payload);
    }

    const saveError = save.error instanceof Error ? save.error.message : null;
    const testResult = test.data;

    return (
        <div className="settings-page">
            <header className="settings-page__topbar">
                <h1 className="settings-page__title">Settings</h1>
                <p className="settings-page__subtitle">Configure integrations used by DaleelEx</p>
            </header>

            <form className="settings-card" onSubmit={handleSave}>
                <div className="settings-card__head">
                    <span className="settings-card__name">Jenkins</span>
                    {config && <span className="settings-card__source">source: {config.source}</span>}
                </div>

                {saveError && <div className="settings-error" role="alert">{saveError}</div>}
                {testResult && <div className={`settings-test-result ${testResult.ok ? 'ok' : 'fail'}`}>{testResult.message}</div>}

                <label className="form-field">
                    <span className="field-label">Base URL</span>
                    <input className="field-input mono" type="text" placeholder="http://jenkins:8080" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                </label>

                <div className="form-row">
                    <label className="form-field">
                        <span className="field-label">Username</span>
                        <input className="field-input" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </label>

                    <label className="form-field">
                        <span className="field-label">API token {config?.tokenSet && <em>(already set — leave blank to keep)</em>}</span>
                        <input className="field-input mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
                    </label>
                </div>

                <div className="settings-card__actions">
                    <button type="button" className="btn-ghost" onClick={() => test.mutate(payload)} disabled={test.isPending}>
                        {test.isPending ? 'Testing…' : 'Test connection'}
                    </button>
                    <button type="submit" className="btn-primary" disabled={save.isPending}>
                        {save.isPending ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
};