import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then(res => {
      setUnread(res.data.filter(n => !n.read).length);
    }).catch(() => {});
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  function dashboardLink() {
    if (!user) return null;
    if (user.role === 'patient') return '/dashboard';
    if (user.role === 'doctor') return '/doctor-dashboard';
    if (user.role === 'admin') return '/admin';
    return '/';
  }

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <span className="brand-icon">🩺</span> Doctor Channeling
      </Link>
      <nav className="nav-links">
        <Link to="/doctors">Find Doctors</Link>
        <Link to="/live">Live Queue</Link>
        {user && (
          <Link to={dashboardLink()}>
            Dashboard{unread > 0 ? ` (${unread})` : ''}
          </Link>
        )}
        {!user && <Link to="/login">Login</Link>}
        {!user && <Link to="/register" className="btn-link">Sign Up</Link>}
        {user && (
          <span className="nav-user">
            {user.name} <span className="role-pill">{user.role}</span>
            <button className="btn-plain" onClick={handleLogout}>Logout</button>
          </span>
        )}
        <ThemeToggle />
      </nav>
    </header>
  );
}
