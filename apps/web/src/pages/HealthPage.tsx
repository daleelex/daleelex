import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { CHECKS, computeHealth, STATE_LABEL, type ServiceHealth } from '../lib/health';
import './HealthPage.css';

const LIFECYCLE_LABEL = { production: 'Production', beta: 'Beta', deprecated: 'Deprecated' };

export function HealthPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });
  const [params, setParams] = useSearchParams();

  const health = useMemo(() => computeHealth(data?.data ?? []), [data]);
  const ready = health.healthyServices;

  // The filter lives in the URL so a link to "everything without a runbook" can be shared.
  const activeCheck = CHECKS.find((check) => check.id === params.get('gap')) ?? null;
  const rows = activeCheck ? health.rows.filter((row) => !row.checks[activeCheck.id]) : health.rows;

  const failing = health.checkSummary.filter((item) => item.missing > 0);
  const passing = health.checkSummary.filter((item) => item.missing === 0);

  function setGap(id: string | null) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('gap', id);
      else next.delete('gap');
      return next;
    });
  }

  return (
    <div className="ready-body">
      <header className="ready-head">
        <div className="ready-kicker">Readiness</div>
        <h1 className="ready-title">{headline(isLoading, isError, ready, health.total)}</h1>
        <p className="ready-sub">
          A service is ready when its catalog entry has an SLO target, an owner, a runbook and a
          dashboard, and it is running in production. This is what each team has declared in{' '}
          <code>catalog-info.yaml</code> — it is not a measure of live uptime.
        </p>
      </header>

      {!isLoading && !isError && health.total > 0 && (
        <>
          <section className="ready-gaps" aria-labelledby="ready-gaps-title">
            <h2 id="ready-gaps-title" className="ready-section-title">
              {failing.length > 0 ? 'What’s missing' : 'Nothing is missing'}
            </h2>

            {failing.length > 0 && (
              <div className="gap-cards">
                {failing.map(({ check, missing }) => {
                  const active = activeCheck?.id === check.id;
                  return (
                    <button
                      key={check.id}
                      type="button"
                      className={`gap-card${active ? ' active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setGap(active ? null : check.id)}
                    >
                      <strong>{missing}</strong>
                      <span>{check.describeMissing(missing)}</span>
                      <small>{active ? 'Showing these — click to clear' : 'Show these'}</small>
                    </button>
                  );
                })}
              </div>
            )}

            {passing.length > 0 && (
              <p className="ready-passing">
                <Tick />
                <span>
                  Complete for every service: {passing.map((item) => item.check.label).join(', ')}.
                </span>
              </p>
            )}
          </section>

          <section className="ready-panel" aria-labelledby="ready-table-title">
            <div className="ready-panel-head">
              <h2 id="ready-table-title" className="ready-section-title">
                {activeCheck
                  ? `${rows.length} ${activeCheck.describeMissing(rows.length)}`
                  : `All ${health.total} services`}
              </h2>
              {activeCheck && (
                <button type="button" className="ready-clear" onClick={() => setGap(null)}>
                  Show all {health.total}
                </button>
              )}
            </div>

            <div className="ready-table-wrap">
              <table className="ready-table">
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Status</th>
                    {CHECKS.map((check) => (
                      <th
                        key={check.id}
                        scope="col"
                        className={activeCheck?.id === check.id ? 'active' : undefined}
                      >
                        {check.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ServiceRow key={row.service.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function headline(isLoading: boolean, isError: boolean, ready: number, total: number) {
  if (isLoading) return 'Checking the catalog…';
  if (isError) return 'The catalog could not be loaded';
  if (total === 0) return 'No services in the catalog yet';
  if (ready === total) return `All ${total} services are ready`;
  return `${ready} of ${total} services are ready`;
}

function ServiceRow({ row }: { row: ServiceHealth }) {
  const { service, checks } = row;
  const slo = [service.sloTarget, service.sloWindow].filter(Boolean).join(' over ');

  return (
    <tr>
      <th scope="row">
        <Link to={`/services?service=${encodeURIComponent(service.id)}`} className="ready-service">
          <strong>{service.name}</strong>
          <span>
            {service.id} · Tier {service.tier}
          </span>
        </Link>
      </th>
      <td>
        <span className={`state-pill ${row.state}`}>{STATE_LABEL[row.state]}</span>
      </td>
      <Check ok={checks.slo}>{slo || 'Not set'}</Check>
      <Check ok={checks.owner}>{service.owner?.name ?? 'Unassigned'}</Check>
      <Check ok={checks.runbook}>
        <OpsLink url={row.runbookUrl} name={`${service.name} runbook`} />
      </Check>
      <Check ok={checks.dashboard}>
        <OpsLink url={row.dashboardUrl} name={`${service.name} dashboard`} />
      </Check>
      <Check ok={checks.production}>{LIFECYCLE_LABEL[service.lifecycle]}</Check>
    </tr>
  );
}

// Pass and fail differ by icon and wording as well as colour.
function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <td>
      <span className={`check ${ok ? 'ok' : 'missing'}`}>
        {ok ? <Tick /> : <Cross />}
        <span className="sr-only">{ok ? 'Pass: ' : 'Missing: '}</span>
        <span>{children}</span>
      </span>
    </td>
  );
}

function OpsLink({ url, name }: { url: string | null; name: string }) {
  if (!url) return <>Not linked</>;
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${name}`}>
      Open
    </a>
  );
}

function Tick() {
  return (
    <svg className="check-icon ok" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2.5 7.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      className="check-icon missing"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <path
        d="M3.5 3.5l7 7m0-7l-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
