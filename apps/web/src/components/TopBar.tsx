import { useLocation } from 'react-router-dom';
import { UserAvatar } from './UserAvatar';
import './TopBar.css';

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/services': 'Catalog',
  '/teams': 'Teams',
  '/docs': 'TechDocs',
  '/health': 'Health & SLO',
  '/settings': 'Settings',
};

interface TopBarProps {
  onOpenSearch: () => void;
  actionsRef: (element: HTMLDivElement | null) => void;
}

export function TopBar({ onOpenSearch, actionsRef }: TopBarProps) {
  const { pathname } = useLocation();
  const current = PAGE_LABELS[pathname] ?? 'DaleelEx';

  return (
    <header className="topbar">
      <div className="crumb">
        <span>DaleelEx</span>
        <ChevronRight />
        <span className="current">{current}</span>
      </div>
      <div className="top-right">
        <button type="button" className="search search-trigger" onClick={onOpenSearch}>
          <SearchIcon />
          <span className="search-trigger-label">Search services, teams, docs…</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
        <div className="topbar-actions" ref={actionsRef} />
        <UserAvatar />
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ color: 'var(--muted)', flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
