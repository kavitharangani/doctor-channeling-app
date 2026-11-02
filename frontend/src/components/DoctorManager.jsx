import { useEffect, useRef, useState } from 'react';
import api from '../api';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];
const EMPTY_FORM = {
  name: '', email: '', password: '', specialtyId: '',
  qualifications: '', experienceYears: '', consultationFee: '', bio: ''
};

function initials(name) {
  return name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function DoctorFormDialog({ doctor, specialties, onClose, onSaved }) {
  const isEdit = Boolean(doctor);
  const [form, setForm] = useState(isEdit ? { ...EMPTY_FORM, ...doctor, password: '' } : EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  function update(field) {
    return e => setForm({ ...form, [field]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.put(`/admin/doctors/${doctor.id}`, form)
        : await api.post('/admin/doctors', form);
      onSaved(saved.data, isEdit);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save doctor');
      setSaving(false);
      dialogRef.current.querySelector('.doctor-dialog-body').scrollTop = 0;
    }
  }

  return (
    <dialog ref={dialogRef} className="doctor-dialog" onClose={onClose} aria-labelledby="doctor-dialog-title">
      <form onSubmit={submit}>
        <header className="doctor-dialog-header">
          <h2 id="doctor-dialog-title">{isEdit ? 'Edit doctor' : 'Add a doctor'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>&times;</button>
        </header>

        <div className="doctor-dialog-body">
          {error && <div className="error-banner" role="alert">{error}</div>}

          <h3 className="form-section-title">Profile</h3>
          <div className="form-grid doctor-form-grid">
            <label className="span-2">
              Full name
              <input value={form.name} onChange={update('name')} placeholder="Dr. Amali Wijesinghe" required autoFocus />
            </label>
            <label>
              Specialty
              <select value={form.specialtyId} onChange={update('specialtyId')} required>
                <option value="" disabled>Select specialty</option>
                {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label>
              Qualifications
              <input value={form.qualifications} onChange={update('qualifications')} placeholder="MBBS, MD" />
            </label>
            <label>
              Experience (years)
              <input type="number" min="0" value={form.experienceYears} onChange={update('experienceYears')} placeholder="0" />
            </label>
            <label>
              Consultation fee (Rs.)
              <input type="number" min="0" value={form.consultationFee} onChange={update('consultationFee')} placeholder="0" />
            </label>
            <label className="span-2">
              Bio
              <textarea value={form.bio} onChange={update('bio')} placeholder="Shown to patients on the doctor's profile" />
            </label>
          </div>

          <h3 className="form-section-title">Login account</h3>
          <div className="form-grid doctor-form-grid">
            <label>
              Login email
              <input type="email" value={form.email} onChange={update('email')} placeholder="name@channel.app" required />
            </label>
            <label>
              {isEdit ? 'New password' : 'Temporary password'}
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                minLength={6}
                required={!isEdit}
                autoComplete="new-password"
                placeholder={isEdit ? 'Leave blank to keep current' : 'At least 6 characters'}
              />
            </label>
          </div>
        </div>

        <footer className="doctor-dialog-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add doctor'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function DoctorCard({ doctor, onEdit, onToggleActive }) {
  const active = doctor.active !== false;
  return (
    <article className={`manage-card${active ? '' : ' inactive'}`}>
      <div className="manage-card-top">
        <div className="doctor-avatar">{initials(doctor.name)}</div>
        <div className="manage-card-title">
          <h3>{doctor.name}</h3>
          <p className="specialty">{doctor.specialtyName}</p>
          <p className="meta manage-card-email">{doctor.email}</p>
        </div>
        <span className={`status-pill ${active ? 'on' : 'off'}`}>{active ? 'Active' : 'Inactive'}</span>
      </div>

      <dl className="manage-card-facts">
        <div><dt>Fee</dt><dd>Rs. {Number(doctor.consultationFee).toLocaleString()}</dd></div>
        <div><dt>Experience</dt><dd>{doctor.experienceYears} yrs</dd></div>
        <div>
          <dt>Rating</dt>
          <dd>{doctor.avgRating ? `★ ${doctor.avgRating} (${doctor.reviewCount})` : '—'}</dd>
        </div>
      </dl>

      {doctor.qualifications && <p className="meta">{doctor.qualifications}</p>}

      {doctor.schedules.length > 0 ? (
        <ul className="clinic-chips" aria-label="Clinic hours">
          {doctor.schedules.map(s => (
            <li key={s.id}>{DAY_SHORT[s.dayOfWeek]} {s.startTime}–{s.endTime}</li>
          ))}
        </ul>
      ) : (
        <p className="no-clinic">No clinic schedule yet, so patients can't book</p>
      )}

      <div className="manage-card-actions">
        <button className="secondary-btn" onClick={() => onEdit(doctor)}>Edit</button>
        <button
          className={active ? 'danger-btn' : 'secondary-btn'}
          onClick={() => onToggleActive(doctor)}
        >
          {active ? 'Deactivate' : 'Reactivate'}
        </button>
      </div>
    </article>
  );
}

export default function DoctorManager({ specialties, onChanged }) {
  const [doctors, setDoctors] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [q, setQ] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [status, setStatus] = useState('all');
  // null = closed, 'new' = adding, otherwise the doctor being edited
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  function load() {
    setLoadFailed(false);
    return api.get('/admin/doctors')
      .then(res => setDoctors(res.data))
      .catch(() => setLoadFailed(true));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  async function afterChange(text) {
    setMessage(text);
    await load();
    onChanged();
  }

  function handleSaved(doctor, wasEdit) {
    setEditing(null);
    afterChange(`${doctor.name} ${wasEdit ? 'updated' : 'added'}`);
  }

  async function toggleActive(doctor) {
    const active = doctor.active !== false;
    if (active && !confirm(`Deactivate ${doctor.name}? Patients will no longer see them in the doctor list.`)) return;
    setActionError('');
    try {
      if (active) await api.delete(`/admin/doctors/${doctor.id}`);
      else await api.post(`/admin/doctors/${doctor.id}/activate`);
      afterChange(`${doctor.name} ${active ? 'deactivated' : 'reactivated'}`);
    } catch (err) {
      setActionError(err.response?.data?.error || `Could not update ${doctor.name}`);
    }
  }

  if (loadFailed) {
    return (
      <div className="manager-empty">
        <p>Could not load doctors. Check that the backend is running.</p>
        <button className="secondary-btn" onClick={load}>Try again</button>
      </div>
    );
  }
  if (!doctors) return <div className="page-loading">Loading doctors...</div>;

  const activeCount = doctors.filter(d => d.active !== false).length;
  const counts = { all: doctors.length, active: activeCount, inactive: doctors.length - activeCount };

  const needle = q.trim().toLowerCase();
  const visible = doctors
    .filter(d => status === 'all' || (status === 'active') === (d.active !== false))
    .filter(d => !specialtyId || d.specialtyId === specialtyId)
    .filter(d => !needle || `${d.name} ${d.email} ${d.qualifications}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));

  return (
    <section className="doctor-manager">
      <div className="manager-header">
        <div>
          <h2>Doctors</h2>
          <p className="meta">{activeCount} active of {doctors.length} total</p>
        </div>
        <button className="primary-btn" onClick={() => setEditing('new')}>+ Add doctor</button>
      </div>

      <div className="manager-filters">
        <input
          type="search"
          aria-label="Search doctors"
          placeholder="Search name, email or qualification..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select aria-label="Filter by specialty" value={specialtyId} onChange={e => setSpecialtyId(e.target.value)}>
          <option value="">All specialties</option>
          {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              className={status === f.value ? 'active' : ''}
              aria-pressed={status === f.value}
              onClick={() => setStatus(f.value)}
            >
              {f.label} <span>{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {actionError && <div className="error-banner" role="alert">{actionError}</div>}

      {visible.length === 0 ? (
        <div className="manager-empty">
          {doctors.length === 0 ? (
            <>
              <p>No doctors yet. Add the first one to start taking bookings.</p>
              <button className="primary-btn" onClick={() => setEditing('new')}>+ Add doctor</button>
            </>
          ) : (
            <p>No doctors match these filters.</p>
          )}
        </div>
      ) : (
        <div className="manage-grid">
          {visible.map(d => (
            <DoctorCard key={d.id} doctor={d} onEdit={setEditing} onToggleActive={toggleActive} />
          ))}
        </div>
      )}

      {editing && (
        <DoctorFormDialog
          doctor={editing === 'new' ? null : editing}
          specialties={specialties}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="toast-region" role="status">
        {message && <div className="toast">{message}</div>}
      </div>
    </section>
  );
}
