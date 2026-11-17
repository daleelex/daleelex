import type { Service } from '@daleelex/shared';
import { STATE_LABEL, type ServiceHealth } from '../lib/health';
import { LIFECYCLE_COLOR } from './ServiceCard';
import './ServiceCard.css';
import './ServiceTable.css';

interface Props {
  rows: ServiceHealth[];
  onOpen: (service: Service) => void;
}

// The dense view of the catalog: one line per service, for scanning and
// comparing rather than browsing.
export function ServiceTable({ rows, onOpen }: Props) {
  return (
    <div className="service-table-wrap">
      <table className="service-table">
        <thead>
          <tr>
            <th scope="col">Service</th>
            <th scope="col">Type</th>
            <th scope="col">Tier</th>
            <th scope="col">Owner</th>
            <th scope="col">Lifecycle</th>
            <th scope="col">SLO</th>
            <th scope="col">Health</th>
            <th scope="col" className="num">
              Readiness
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ service, state, score, gaps }) => (
            <tr key={service.id} onClick={() => onOpen(service)}>
              <th scope="row">
                {/* The button makes the row reachable by keyboard; the row's
                    own click handler is a larger target for the mouse. */}
                <button
                  className="service-table-open"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(service);
                  }}
                >
                  {service.name}
                </button>
                <span className="service-table-id">{service.id}</span>
              </th>
              <td>
                <span className={`type-label cat-${service.type}`}>{service.type}</span>
              </td>
              <td>
                <span className={`tier-badge tier-${service.tier}`}>T{service.tier}</span>
              </td>
              <td className={service.owner ? undefined : 'unowned'}>
                {service.owner?.name ?? 'Unowned'}
              </td>
              <td>
                <span className="lifecycle">
                  <span
                    className="lifecycle-dot"
                    style={{ background: LIFECYCLE_COLOR[service.lifecycle] ?? 'var(--muted)' }}
                  />
                  {service.lifecycle}
                </span>
              </td>
              <td className="mono">{service.sloTarget ?? '—'}</td>
              <td>
                <span
                  className={`state-pill ${state}`}
                  title={gaps.length > 0 ? gaps.join(' · ') : 'Fully described'}
                >
                  {STATE_LABEL[state]}
                </span>
              </td>
              <td className="num mono">{score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
