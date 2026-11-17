import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import './CommandPalette.css';

type ItemGroup = 'Services' | 'Teams' | 'Docs' | 'Pages';

interface PaletteItem {
  key: string;
  group: ItemGroup;
  title: string;
  subtitle: string;
  to: string;
}

const GROUP_ORDER: ItemGroup[] = ['Services', 'Teams', 'Docs', 'Pages'];

// Cap each group so one noisy match set can't push the others off the list.
const PER_GROUP = 6;

const PAGES: PaletteItem[] = [
  { key: 'page:home', group: 'Pages', title: 'Home', subtitle: 'Overview dashboard', to: '/' },
  {
    key: 'page:catalog',
    group: 'Pages',
    title: 'Catalog',
    subtitle: 'Every registered service',
    to: '/services',
  },
  { key: 'page:teams', group: 'Pages', title: 'Teams', subtitle: 'Owners and gaps', to: '/teams' },
  {
    key: 'page:docs',
    group: 'Pages',
    title: 'TechDocs',
    subtitle: 'Service documentation',
    to: '/docs',
  },
  {
    key: 'page:health',
    group: 'Pages',
    title: 'Readiness',
    subtitle: 'What each service is missing',
    to: '/health',
  },
  {
    key: 'page:settings',
    group: 'Pages',
    title: 'Settings',
    subtitle: 'Profile and integrations',
    to: '/settings',
  },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The pages prime these same cache keys, so opening the palette is usually
  // free — enabled keeps us from fetching all three on a page that needs none.
  const servicesQuery = useQuery({ queryKey: ['services'], queryFn: api.services, enabled: open });
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: api.teams, enabled: open });
  const docsQuery = useQuery({
    queryKey: ['techdocs-index'],
    queryFn: api.techDocsIndex,
    enabled: open,
  });

  const items = useMemo(() => {
    const all: PaletteItem[] = [];

    for (const service of servicesQuery.data?.data ?? []) {
      all.push({
        key: `service:${service.id}`,
        group: 'Services',
        title: service.name,
        subtitle: `${service.id} · Tier ${service.tier} · ${service.owner?.name ?? 'Unowned'}`,
        to: `/services?service=${encodeURIComponent(service.id)}`,
      });
    }

    for (const team of teamsQuery.data?.data ?? []) {
      all.push({
        key: `team:${team.id}`,
        group: 'Teams',
        title: team.name,
        subtitle: `${team.id} · ${team.serviceCount} service${team.serviceCount === 1 ? '' : 's'}`,
        to: `/teams?team=${encodeURIComponent(team.id)}`,
      });
    }

    for (const entry of docsQuery.data?.data ?? []) {
      for (const doc of entry.docs) {
        all.push({
          key: `doc:${entry.service.id}:${doc.id}`,
          group: 'Docs',
          title: doc.title,
          subtitle: `${entry.service.name} · ${doc.path}`,
          to: `/docs?service=${encodeURIComponent(entry.service.id)}&doc=${doc.id}`,
        });
      }
    }

    all.push(...PAGES);
    return all;
  }, [servicesQuery.data, teamsQuery.data, docsQuery.data]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? items.filter(
          (item) =>
            item.title.toLowerCase().includes(needle) ||
            item.subtitle.toLowerCase().includes(needle),
        )
      : items;

    // Number the rows as they are laid out so arrow keys can walk the whole
    // list across group boundaries.
    const grouped: { group: ItemGroup; rows: { item: PaletteItem; index: number }[] }[] = [];
    let index = 0;
    for (const group of GROUP_ORDER) {
      const inGroup = matched.filter((item) => item.group === group).slice(0, PER_GROUP);
      if (inGroup.length === 0) continue;
      grouped.push({ group, rows: inGroup.map((item) => ({ item, index: index++ })) });
    }
    return grouped;
  }, [items, query]);

  const flat = useMemo(
    () => results.flatMap((section) => section.rows.map((r) => r.item)),
    [results],
  );

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const isLoading = servicesQuery.isLoading || teamsQuery.isLoading || docsQuery.isLoading;

  function select(item: PaletteItem) {
    navigate(item.to);
    onClose();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((prev) => (flat.length === 0 ? 0 : (prev + 1) % flat.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((prev) => (flat.length === 0 ? 0 : (prev - 1 + flat.length) % flat.length));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = flat[active];
      if (item) select(item);
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search DaleelEx"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="palette-input-row">
          <SearchIcon />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            placeholder="Search services, teams, docs…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search services, teams and docs"
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div className="palette-list" ref={listRef}>
          {isLoading && flat.length === 0 && <div className="palette-empty">Loading catalog…</div>}
          {!isLoading && flat.length === 0 && (
            <div className="palette-empty">
              <strong>No matches for “{query.trim()}”.</strong>
              <span>Try a service ID, a team, or a doc title.</span>
            </div>
          )}
          {results.map((section) => (
            <div key={section.group} className="palette-group">
              <div className="palette-group-label">{section.group}</div>
              {section.rows.map(({ item, index }) => (
                <button
                  key={item.key}
                  type="button"
                  className="palette-item"
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => select(item)}
                >
                  <span className="palette-item-title">{item.title}</span>
                  <span className="palette-item-sub">{item.subtitle}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="palette-foot">
          <span>
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="kbd">↵</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
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
