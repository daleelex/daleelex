import { memo, type ReactNode } from 'react';

interface KpiConfig {
    label: string;
    value: string | number;
    sub: string;
    accent: 'teal' | 'royal' | 'navy' | 'ocean';
}

export const KpiCard = memo<KpiConfig & { index: number }>(({ label, value, sub, accent, index }) => (
    <div className={`kpi-card kpi-card--${accent}`} style={{ animationDelay: `${index * 60}ms` }}>
        <span className="kpi-card__label">{label}</span>
        <div className="kpi-card__value">{value}</div>
        <div className="kpi-card__sub">{sub}</div>
    </div>
));
KpiCard.displayName = 'KpiCard';

export const SectionHeader = memo<{ title: string; action?: ReactNode }>(({ title, action }) => (
    <div className="section-header">
        <h2 className="section-header__title">{title}</h2>
        {action}
    </div>
));
SectionHeader.displayName = 'SectionHeader';