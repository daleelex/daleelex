import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Menu, Hexagon } from 'lucide-react';
import type { SidebarItem, SidebarProps } from './side-bar.types';
import { sidebarItems } from './side-bar.config';
import './side-bar.scss';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const renderIcon = (icon?: any, className?: string) => {
  if (!icon) return null;
  if (typeof icon === 'function') {
    const Icon = icon;
    return <Icon className={className} />;
  }
  return icon;
};

const isRouteActive = (route: string | undefined, currentPath: string): boolean => {
  if (!route) return false;
  return currentPath === route || currentPath.startsWith(`${route}/`);
};

const hasActiveChild = (item: SidebarItem, currentPath: string): boolean => {
  if (!item.children) return false;
  return item.children.some(
    (child: SidebarItem) =>
      isRouteActive(child.route, currentPath) ||
      (child.type === 'group' && hasActiveChild(child, currentPath)),
  );
};

// ─── Nav Item ─────────────────────────────────────────────────────────────────
const NavItem = memo<{
  item: SidebarItem;
  level: number;
  currentPath: string;
  expanded: boolean;
  onNavigate: () => void;
}>(({ item, level, currentPath, expanded, onNavigate }) => {
  const navigate = useNavigate();
  const active = isRouteActive(item.route, currentPath);

  const handleClick = useCallback(() => {
    if (item.route) {
      navigate(item.route);
      onNavigate();
    }
  }, [item.route, navigate, onNavigate]);

  return (
    <button
      className={`nav-item ${active ? 'nav-item--active' : ''}`}
      style={{ paddingLeft: expanded ? `${18 + level * 14}px` : undefined }}
      onClick={handleClick}
      type="button"
      role="link"
      aria-current={active ? 'page' : undefined}
      title={!expanded ? item.text : undefined}
    >
      {item.icon && (
        <span className="nav-item__icon">
          {renderIcon(item.icon, 'nav-item__svg')}
        </span>
      )}
      {!item.icon && level > 0 && <span className="nav-item__dot" />}
      {expanded && <span className="nav-item__text">{item.text}</span>}
      {active && expanded && <span className="nav-item__active-dot" />}
    </button>
  );
});
NavItem.displayName = 'NavItem';

// ─── Nav Group ────────────────────────────────────────────────────────────────
const NavGroup = memo<{
  item: SidebarItem;
  level: number;
  currentPath: string;
  expanded: boolean;
  onNavigate: () => void;
}>(({ item, level, currentPath, expanded, onNavigate }) => {
  const childActive = hasActiveChild(item, currentPath);
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive && !open) setOpen(true);
  }, [childActive]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return (
    <div className={`nav-group ${open ? 'nav-group--open' : ''}`}>
      <button
        className={`nav-group__toggle ${childActive ? 'nav-group__toggle--child-active' : ''}`}
        style={{ paddingLeft: expanded ? `${18 + level * 14}px` : undefined }}
        onClick={toggle}
        type="button"
        aria-expanded={open}
        title={!expanded ? item.text : undefined}
      >
        <span className="nav-group__left">
          {item.icon && (
            <span className="nav-item__icon">
              {renderIcon(item.icon, 'nav-item__svg')}
            </span>
          )}
          {expanded && <span className="nav-item__text">{item.text}</span>}
        </span>
        {expanded && (
          <ChevronDown
            size={14}
            className={`nav-group__chevron ${open ? 'nav-group__chevron--open' : ''}`}
          />
        )}
      </button>

      <div
        className="nav-group__children"
        style={{
          maxHeight: open && expanded ? `${(item.children?.length || 0) * 46 + 16}px` : '0px',
        }}
      >
        {item.children?.map((child: SidebarItem, i: number) => (
          <SidebarNavItem
            key={`${child.text}-${i}`}
            item={child}
            level={level + 1}
            currentPath={currentPath}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
});
NavGroup.displayName = 'NavGroup';

// ─── Router ───────────────────────────────────────────────────────────────────
const SidebarNavItem = memo<{
  item: SidebarItem;
  level: number;
  currentPath: string;
  expanded: boolean;
  onNavigate: () => void;
}>(({ item, level, currentPath, expanded, onNavigate }) => {
  if (item.type === 'group' && item.children?.length) {
    return (
      <NavGroup
        item={item}
        level={level}
        currentPath={currentPath}
        expanded={expanded}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <NavItem
      item={item}
      level={level}
      currentPath={currentPath}
      expanded={expanded}
      onNavigate={onNavigate}
    />
  );
});
SidebarNavItem.displayName = 'SidebarNavItem';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export const Sidebar: React.FC<SidebarProps> = ({
  items = sidebarItems,
  version = '2.0.0',
}) => {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const sidebarRef = useRef<HTMLElement>(null);

  const toggleExpand = useCallback(() => setExpanded((prev) => !prev), []);

  // Always collapse after navigating
  const handleNavigate = useCallback(() => {
    setExpanded(false);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        expanded &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expanded) setExpanded(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [expanded]);

  return (
    <>
      {expanded && <div className="sidebar-backdrop" onClick={() => setExpanded(false)} />}

      <nav
        ref={sidebarRef}
        className={`sidebar ${expanded ? 'sidebar--expanded' : 'sidebar--collapsed'}`}
        aria-label="Main navigation"
      >
        <div className="sidebar__header">
          <div className="sidebar__brand" onClick={toggleExpand}>
            <div className="sidebar__logo">
              <Hexagon size={18} />
            </div>
            {expanded && <span className="sidebar__app-name">DaleelEx</span>}
          </div>
          {expanded && (
            <button
              className="sidebar__toggle"
              onClick={toggleExpand}
              type="button"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        <div className="sidebar__nav">
          {items.map((item: SidebarItem, i: number) => (
            <SidebarNavItem
              key={`${item.text}-${i}`}
              item={item}
              level={0}
              currentPath={currentPath}
              expanded={expanded}
              onNavigate={handleNavigate}
            />
          ))}
        </div>

        {expanded && (
          <div className="sidebar__footer">
            <span className="sidebar__version">v{version}</span>
          </div>
        )}
      </nav>
    </>
  );
};