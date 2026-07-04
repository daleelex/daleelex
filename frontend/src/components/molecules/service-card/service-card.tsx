import type { CSSProperties, KeyboardEvent } from 'react';
import type { Service, ServiceType } from '../../../types/catalog.types';
import { CAT_COLORS } from './service-card.config';
import './service-card.scss';

interface Props {
    service: Service;
    onClick?: () => void;
}

const LIFECYCLE_COLOR: Record<string, string> = {
    production: 'var(--ok)',
    beta: 'var(--warn)',
    deprecated: 'var(--muted)',
};

export function ServiceCard({ service, onClick }: Props) {
    const cat = CAT_COLORS[service.type] ?? CAT_COLORS.api;
    const visibleTags = service.tags.slice(0, 2);
    const hiddenTagCount = Math.max(service.tags.length - visibleTags.length, 0);

    function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    }

    return (
        <article
            className="card"
            style={{ '--cat-color': cat.color, '--cat-bg': cat.bg } as CSSProperties}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            tabIndex={onClick ? 0 : undefined}
            role={onClick ? 'button' : undefined}
            aria-label={`Open ${service.name} details`}
        >
            <div className="card-head">
                <div className="card-icon">
                    <TypeIcon type={service.type} />
                </div>
                <span className="type-label">{service.type}</span>
                <span className={`tier-badge tier-${service.tier}`}>T{service.tier}</span>
                <div className="lifecycle">
                    <CircleDot color={LIFECYCLE_COLOR[service.lifecycle] ?? 'var(--muted)'} />
                    <span>{service.lifecycle}</span>
                </div>
            </div>

            <h3 className="card-title">{service.name}</h3>
            <div className="card-id">{service.id}</div>

            {service.description && <p className="card-desc">{service.description}</p>}

            <div className="card-meta">
                <div>
                    <div className="meta-label">Owner</div>
                    <div className="meta-value">{service.owner?.name ?? '—'}</div>
                </div>
                <div>
                    <div className="meta-label">Language</div>
                    <div className="meta-value">{service.language ?? 'Unspecified'}</div>
                </div>
            </div>

            <div className="card-foot">
                <div className="card-foot-item">
                    <div>
                        <div className="meta-label">SLO target</div>
                        <div className="meta-value">{service.sloTarget ?? '—'}</div>
                    </div>
                </div>
                <div className="card-foot-item">
                    {visibleTags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                    {hiddenTagCount > 0 && <span className="tag muted">+{hiddenTagCount}</span>}
                </div>
            </div>
        </article>
    );
}

function CircleDot({ color }: { color: string }) {
    return <svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3.5" fill={color} /></svg>;
}

function TypeIcon({ type }: { type: ServiceType }) {
    switch (type) {
        case 'api':
            return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>;
        case 'db':
            return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>;
        case 'web':
            return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
        case 'ml':
            return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></svg>;
        case 'tool':
            return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;
    }
}