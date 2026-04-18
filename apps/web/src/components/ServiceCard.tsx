import type { Service } from '@daleelex/shared';
import './ServiceCard.css';

interface Props {
  service: Service;
}

const tierLabel: Record<number, string> = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

export function ServiceCard({ service }: Props) {
  return (
    <div className="service-card">
      <div className="card-header">
        <span className="card-name">{service.name}</span>
        <div className="card-badges">
          <span className={`badge tier tier-${service.tier}`}>{tierLabel[service.tier]}</span>
          <span className={`badge lifecycle ${service.lifecycle}`}>{service.lifecycle}</span>
        </div>
      </div>

      {service.description && (
        <p className="card-description">{service.description}</p>
      )}

      <div className="card-meta">
        <span className="meta-item">
          <span className="meta-label">Type</span>
          <span className="meta-value">{service.type}</span>
        </span>
        {service.owner && (
          <span className="meta-item">
            <span className="meta-label">Owner</span>
            <span className="meta-value">{service.owner.name}</span>
          </span>
        )}
        {service.language && (
          <span className="meta-item">
            <span className="meta-label">Language</span>
            <span className="meta-value">{service.language}</span>
          </span>
        )}
        {service.sloTarget && (
          <span className="meta-item">
            <span className="meta-label">SLO</span>
            <span className="meta-value">{service.sloTarget}</span>
          </span>
        )}
      </div>

      {service.tags.length > 0 && (
        <div className="card-tags">
          {service.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
