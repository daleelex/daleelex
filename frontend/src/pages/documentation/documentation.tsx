import { Link } from 'react-router-dom';
import { useTechDocsIndex } from './documentation.hooks';
import './documentation.scss';

export const TechDocsPage: React.FC = () => {
    const { data, isLoading, error } = useTechDocsIndex();
    const groups = data?.data ?? [];

    return (
        <div className="techdocs-page">
            <header className="techdocs-page__topbar">
                <h1 className="techdocs-page__title">TechDocs</h1>
                <p className="techdocs-page__subtitle">Documentation indexed from service repositories</p>
            </header>

            {error && <p className="empty-note">Failed to load documentation index.</p>}

            <div className="techdocs-list">
                {isLoading
                    ? Array.from({ length: 4 }, (_, i) => <div key={i} className="techdocs-skeleton" />)
                    : groups.map((group) => (
                        <Link key={group.service.id} to={`/services/${group.service.id}`} className="techdocs-row">
                            <div className="techdocs-row__main">
                                <span className="techdocs-row__name">{group.service.name}</span>
                                <span className="techdocs-row__type">{group.service.type} · tier {group.service.tier}</span>
                            </div>
                            <span className="techdocs-row__count">{group.docs.length} pages</span>
                        </Link>
                    ))}
                {!isLoading && groups.length === 0 && <p className="empty-note">No documentation has been indexed yet.</p>}
            </div>
        </div>
    );
};