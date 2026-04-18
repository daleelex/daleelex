import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

export function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">DaleelEx</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/services" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Services
          </NavLink>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
