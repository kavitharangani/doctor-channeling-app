import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field) {
    return e => setForm({ ...form, [field]: e.target.value });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Create your account</h1>
        {error && <div className="error-banner">{error}</div>}
        <label>Full name
          <input value={form.name} onChange={update('name')} required />
        </label>
        <label>Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>Phone
          <input value={form.phone} onChange={update('phone')} placeholder="07XXXXXXXX" />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={update('password')} required minLength={6} />
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Creating...' : 'Sign up'}</button>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
