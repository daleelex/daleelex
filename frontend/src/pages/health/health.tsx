import { useSystemHealth, useJenkinsHealth } from './health.hooks';
import './health.scss';

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
    return <span className={`status-pill ${ok ? 'status-pill--ok' : 'status-pill--down'}`}>{label}</span>;
}

export const HealthPage: React.FC = () => {
    const { data: appHealth, isLoading: appLoading } = useSystemHealth();
    const { data: jenkinsHealth, isLoading: jenkinsLoading } = useJenkinsHealth();

    return (
        <div className="health-page">
            <header className="health-page__topbar">
                <h1 className="health-page__title">Health &amp; SLO</h1>
                <p className="health-page__subtitle">Live status of DaleelEx and its integrations</p>
            </header>

            <div className="health-grid">
                <div className="health-card">
                    <div className="health-card__head">
                        <span className="health-card__name">API &amp; Database</span>
                        {!appLoading && appHealth && (
                            <StatusPill ok={appHealth.status === 'up'} label={appHealth.status === 'up' ? 'Operational' : 'Down'} />
                        )}
                    </div>
                    <div className="health-card__body">
                        <div className="health-kv"><span>Version</span><span>{appHealth?.version ?? '—'}</span></div>
                        <div className="health-kv"><span>Checked at</span><span>{appHealth ? new Date(appHealth.dateTime).toLocaleTimeString() : '—'}</span></div>
                    </div>
                </div>

                <div className="health-card">
                    <div className="health-card__head">
                        <span className="health-card__name">Jenkins</span>
                        {!jenkinsLoading && jenkinsHealth && (
                            <StatusPill ok={jenkinsHealth.status === 'ok'} label={jenkinsHealth.status.replace('_', ' ')} />
                        )}
                    </div>
                    <div className="health-card__body">
                        <div className="health-kv"><span>Base URL</span><span>{jenkinsHealth?.baseUrl ?? 'Not configured'}</span></div>
                        <div className="health-kv"><span>Mode</span><span>{jenkinsHealth?.mode ?? '—'}</span></div>
                        <div className="health-kv"><span>Message</span><span>{jenkinsHealth?.message ?? '—'}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};