import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, Settings, CreditCard, LogOut, ChevronDown } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/store';
import { Route as AppRoute } from '../../../configs/enums';
import { clearUser, selectUser, selectInitials } from '../../../store/authSlice';
import { logout } from '../../../pages/login/login.service';
import './top-bar.scss';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  read: boolean;
  timestamp: Date;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'Critical Alarm', message: 'API Gateway latency exceeded threshold', type: 'critical', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: '2', title: 'Incident Resolved', message: 'DB connection pool issue resolved', type: 'success', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 22) },
  { id: '3', title: 'SLA Warning', message: 'Auth Service availability dropped below 99.9%', type: 'warning', read: false, timestamp: new Date(Date.now() - 1000 * 60 * 61) },
  { id: '4', title: 'New Deployment', message: 'v2.4.1 deployed to production', type: 'info', read: true, timestamp: new Date(Date.now() - 1000 * 60 * 120) },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (date: Date): string => {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

const useClickOutside = (ref: React.RefObject<HTMLElement | null>, onClose: () => void) => {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
};

// ─── Notification Panel ───────────────────────────────────────────────────────
const NotificationPanel = memo<{
  notifications: Notification[];
  onMarkAllRead: () => void;
}>(({ notifications, onMarkAllRead }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="tb__anchor">
      <button
        className="tb__icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications — ${unread} unread`}
        aria-expanded={open}
        type="button"
      >
        <Bell size={17} />
        {unread > 0 && <span className="tb__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="tb__dropdown tb__dropdown--notif" role="dialog" aria-label="Notifications">
          <div className="dd__head">
            <span className="dd__title">Notifications</span>
            {unread > 0 && (
              <button className="dd__link" onClick={onMarkAllRead} type="button">
                Mark all read
              </button>
            )}
          </div>
          <ul className="notif-list" role="list">
            {notifications.length === 0 && (
              <li className="notif-list__empty">You're all caught up</li>
            )}
            {notifications.map((n) => (
              <li key={n.id} className={`notif ${n.read ? 'notif--read' : ''}`}>
                <span className={`notif__dot notif__dot--${n.type}`} />
                <div className="notif__body">
                  <p className="notif__title">{n.title}</p>
                  <p className="notif__msg">{n.message}</p>
                  <time className="notif__time">{timeAgo(n.timestamp)}</time>
                </div>
              </li>
            ))}
          </ul>
          <div className="dd__foot">
            <button className="dd__link" onClick={() => setOpen(false)} type="button">
              View all activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
NotificationPanel.displayName = 'NotificationPanel';

// ─── User Menu ────────────────────────────────────────────────────────────────
const UserMenu = memo(() => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const inits = useAppSelector(selectInitials);

  useClickOutside(ref, () => setOpen(false));

  const handleLogout = useCallback(async () => {
    try { await logout(); } catch { /* ignore */ }
    dispatch(clearUser());
    nav('/login', { replace: true });
  }, [dispatch, nav]);

  const menuItems = [
    { label: 'Profile', sub: 'View your profile', icon: <User size={14} />, action: () => { nav(`/users/${user?.id || 'me'}/profile`); setOpen(false); } },
    { label: 'Settings', sub: 'Integrations & preferences', icon: <Settings size={14} />, action: () => { nav(AppRoute.SETTINGS); setOpen(false); } },
    { label: 'Billing', sub: 'Subscription & usage', icon: <CreditCard size={14} />, action: () => { nav(AppRoute.BILLING); setOpen(false); } },
  ];

  return (
    <div ref={ref} className="tb__anchor">
      <button
        className="tb__avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
        aria-expanded={open}
        type="button"
      >
        {user?.avatarUrl ? (
          <img className="tb__avatar" src={user.avatarUrl} alt="" />
        ) : (
          <span className="tb__avatar tb__avatar--initials">{inits}</span>
        )}
        <ChevronDown size={12} className="tb__chevron" />
      </button>

      {open && (
        <div className="tb__dropdown tb__dropdown--user" role="menu" aria-label="User menu">
          <div className="um__profile">
            {user?.avatarUrl ? (
              <img className="um__avatar" src={user.avatarUrl} alt="" />
            ) : (
              <span className="um__avatar um__avatar--initials">{inits}</span>
            )}
            <div className="um__info">
              <p className="um__name">{user ? `${user.firstName} ${user.lastName}` : '—'}</p>
              <p className="um__email">{user?.email ?? '—'}</p>
              <span className="um__role">{user?.role ?? '—'}</span>
            </div>
          </div>

          <div className="dd__divider" />

          <ul className="um__list" role="menu">
            {menuItems.map((item) => (
              <li key={item.label} role="none">
                <button className="um__item" onClick={item.action} role="menuitem" type="button">
                  <span className="um__item-icon">{item.icon}</span>
                  <span className="um__item-text">
                    <span className="um__item-label">{item.label}</span>
                    <span className="um__item-sub">{item.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="dd__divider" />

          <div className="um__footer">
            <button className="um__logout" onClick={handleLogout} role="menuitem" type="button">
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
UserMenu.displayName = 'UserMenu';

// ─── TopNavBar ────────────────────────────────────────────────────────────────
export const TopNavBar: React.FC<{ pageTitle: string }> = ({ pageTitle }) => {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

  const handleMarkAllRead = useCallback(
    () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  );

  return (
    <header className="tb" role="banner">
      <div className="tb__left">
        <h1 className="tb__title">{pageTitle}</h1>
      </div>
      <div className="tb__right">
        <NotificationPanel notifications={notifications} onMarkAllRead={handleMarkAllRead} />
        <div className="tb__sep" />
        <UserMenu />
      </div>
    </header>
  );
};