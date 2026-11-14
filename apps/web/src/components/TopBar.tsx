import { useLocation } from 'react-router-dom';
import { useTheme } from '../lib/theme';
import { UserAvatar } from './UserAvatar';
import './TopBar.css';

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/services': 'Catalog',
  '/teams': 'Teams',
  '/docs': 'TechDocs',
  '/health': 'Readiness',
  '/settings': 'Settings',
};

interface TopBarProps {
  onOpenSearch: () => void;
  onOpenNav: () => void;
  actionsRef: (element: HTMLDivElement | null) => void;
}

export function TopBar({ onOpenSearch, onOpenNav, actionsRef }: TopBarProps) {
  const { pathname } = useLocation();
  const [theme, setTheme] = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const current = PAGE_LABELS[pathname] ?? 'DaleelEx';

  return (
    <header className="topbar">
      <div className="top-left">
        <button
          type="button"
          className="icon-btn nav-toggle"
          onClick={onOpenNav}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </button>
        <div className="crumb">
          <span className="crumb-root">DaleelEx</span>
          <ChevronRight />
          <span className="current">{current}</span>
        </div>
      </div>
      <div className="top-right">
        <button type="button" className="search search-trigger" onClick={onOpenSearch}>
          <SearchIcon />
          <span className="search-trigger-label">Search services, teams, docs…</span>
          <kbd className="kbd">⌘K</kbd>
        </button>
        <div className="topbar-actions" ref={actionsRef} />
        <button
          type="button"
          className="icon-btn"
          onClick={() => setTheme(nextTheme)}
          aria-label={`Switch to ${nextTheme} mode`}
          title={`Switch to ${nextTheme} mode`}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
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

function MenuIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
