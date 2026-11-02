import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      if (user.role === 'doctor') navigate('/doctor-dashboard');
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Log in</h1>
        {error && <div className="error-banner">{error}</div>}
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
        <p className="auth-switch">No account? <Link to="/register">Sign up</Link></p>
        <div className="demo-hint">
          <strong>Demo logins:</strong>
          <div>Admin: admin@channel.app / admin123</div>
          <div>Doctor: nimal.perera@channel.app / doctor123</div>
          <div>Patient: patient@channel.app / patient123</div>
        </div>
      </form>
    </div>
  );
}
