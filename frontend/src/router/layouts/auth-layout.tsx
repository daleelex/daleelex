import { Outlet } from 'react-router-dom';
// import './auth-layout.scss';


export const AuthLayout: React.FC = () => (
  <div className="auth-layout">
    <Outlet />
  </div>
);