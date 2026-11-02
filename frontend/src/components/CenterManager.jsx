import { useEffect, useState } from 'react';
import api from '../api';
import { money } from '../utils/format';

const EMPTY_FORM = { name: '', city: '', address: '', phone: '', hospitalFee: '', bookingFee: '' };

export default function CenterManager({ onChanged }) {
  const [centers, setCenters] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  function load() {
    return api.get('/admin/centers').then(res => setCenters(res.data)).catch(() => setError('Could not load centres'));
  }

  useEffect(() => { load(); }, []);

  function update(field) {
    return e => setForm({ ...form, [field]: e.target.value });
  }

  function startEdit(center) {
    setEditingId(center.id);
    setForm({ ...EMPTY_FORM, ...center });
    setError('');
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) await api.put(`/admin/centers/${editingId}`, form);
      else await api.post('/admin/centers', form);
      reset();
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save centre');
    }
  }

  async function toggleActive(center) {
    const active = center.active !== false;
    if (active && !confirm(`Deactivate ${center.name}? Patients will stop seeing its sessions.`)) return;
    setError('');
    try {
      await api.put(`/admin/centers/${center.id}`, { ...center, active: !active });
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update centre');
    }
  }

  return (
    <section>
      <form className="admin-form" onSubmit={submit}>
        <h3>{editingId ? 'Edit centre' : 'Add a centre'}</h3>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="center-form-grid">
          <label>Centre name<input value={form.name} onChange={update('name')} required /></label>
          <label>City<input value={form.city} onChange={update('city')} /></label>
          <label>Address<input value={form.address} onChange={update('address')} /></label>
          <label>Phone<input value={form.phone} onChange={update('phone')} /></label>
          <label>Centre fee (Rs.)<input type="number" min="0" value={form.hospitalFee} onChange={update('hospitalFee')} /></label>
          <label>Booking fee (Rs.)<input type="number" min="0" value={form.bookingFee} onChange={update('bookingFee')} /></label>
        </div>
        <div className="book-actions">
          {editingId && <button type="button" className="secondary-btn" onClick={reset}>Cancel</button>}
          <button type="submit" className="primary-btn">{editingId ? 'Save changes' : 'Add centre'}</button>
        </div>
      </form>

      {!centers ? (
        !error && <div className="page-loading">Loading centres...</div>
      ) : (
        <div className="admin-table">
          {centers.map(c => {
            const active = c.active !== false;
            return (
              <div key={c.id} className="admin-row wrap">
                <div>
                  <strong>{c.name}</strong>{c.city ? `, ${c.city}` : ''}
                  {!active && <span className="status-pill off inline-pill">Inactive</span>}
                  <div className="meta">Centre fee {money(c.hospitalFee)} &middot; Booking fee {money(c.bookingFee)}</div>
                  {(c.address || c.phone) && <div className="meta">{[c.address, c.phone].filter(Boolean).join(' · ')}</div>}
                </div>
                <div className="row-actions">
                  <button className="secondary-btn" onClick={() => startEdit(c)}>Edit</button>
                  <button className={active ? 'danger-btn' : 'secondary-btn'} onClick={() => toggleActive(c)}>
                    {active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
