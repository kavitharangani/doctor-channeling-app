import { useEffect, useState } from 'react';
import api from '../api';
import CenterManager from '../components/CenterManager';
import DoctorManager from '../components/DoctorManager';
import SessionBoard from '../components/SessionBoard';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function NewSpecialty({ onDone }) {
  const [name, setName] = useState('');
  return (
    <form className="inline-form" onSubmit={async e => {
      e.preventDefault();
      if (!name) return;
      await api.post('/admin/specialties', { name });
      setName('');
      onDone();
    }}>
      <input placeholder="New specialty name" value={name} onChange={e => setName(e.target.value)} />
      <button type="submit" className="primary-btn">Add</button>
    </form>
  );
}

function ScheduleManager({ doctors }) {
  const [centers, setCenters] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({
    doctorId: '', centerId: '', dayOfWeek: 1, startTime: '18:00', endTime: '20:00', slotMinutes: 10
  });
  const [error, setError] = useState('');

  function load() {
    api.get('/admin/schedules').then(res => setSchedules(res.data)).catch(() => setError('Could not load schedules'));
  }

  useEffect(() => {
    load();
    api.get('/centers').then(res => setCenters(res.data)).catch(() => {});
  }, []);

  function update(field) {
    return e => setForm({ ...form, [field]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/schedules', form);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add schedule');
    }
  }

  async function remove(schedule) {
    if (!confirm(`Remove ${schedule.doctorName}'s ${DAY_LABELS[schedule.dayOfWeek]} session?`)) return;
    setError('');
    try {
      await api.delete(`/admin/schedules/${schedule.id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove schedule');
    }
  }

  const sorted = [...schedules].sort((a, b) =>
    a.doctorName.localeCompare(b.doctorName) || a.dayOfWeek - b.dayOfWeek);

  return (
    <>
      <form className="admin-form" onSubmit={submit}>
        <h3>Add weekly session</h3>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <div className="center-form-grid">
          <label>
            Doctor
            <select value={form.doctorId} onChange={update('doctorId')} required>
              <option value="" disabled>Select doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>
            Centre
            <select value={form.centerId} onChange={update('centerId')} required>
              <option value="" disabled>Select centre</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            Day
            <select value={form.dayOfWeek} onChange={update('dayOfWeek')}>
              {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </label>
          <label>Starts<input type="time" value={form.startTime} onChange={update('startTime')} required /></label>
          <label>Ends<input type="time" value={form.endTime} onChange={update('endTime')} required /></label>
          <label>Minutes per patient<input type="number" min="1" value={form.slotMinutes} onChange={update('slotMinutes')} required /></label>
        </div>
        <button type="submit" className="primary-btn">Add session</button>
      </form>

      <div className="admin-table">
        {sorted.map(s => (
          <div key={s.id} className="admin-row wrap">
            <div>
              <strong>{s.doctorName}</strong>
              <div className="meta">{DAY_LABELS[s.dayOfWeek]}, {s.startTime} to {s.endTime} &middot; {s.centerName}</div>
            </div>
            <button className="danger-btn" onClick={() => remove(s)}>Remove</button>
          </div>
        ))}
      </div>
    </>
  );
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tab, setTab] = useState('overview');

  function refresh() {
    api.get('/admin/reports/summary').then(res => setSummary(res.data));
    api.get('/doctors').then(res => setDoctors(res.data));
    api.get('/doctors/specialties').then(res => setSpecialties(res.data));
    api.get('/admin/appointments').then(res => setAppointments(res.data));
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="dashboard">
      <h1>Admin Dashboard</h1>
      <div className="tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>
        <button className={tab === 'sessions' ? 'active' : ''} onClick={() => setTab('sessions')}>Front Desk</button>
        <button className={tab === 'centers' ? 'active' : ''} onClick={() => setTab('centers')}>Centres</button>
        <button className={tab === 'doctors' ? 'active' : ''} onClick={() => setTab('doctors')}>Doctors</button>
        <button className={tab === 'specialties' ? 'active' : ''} onClick={() => setTab('specialties')}>Specialties</button>
        <button className={tab === 'schedules' ? 'active' : ''} onClick={() => setTab('schedules')}>Schedules</button>
        <button className={tab === 'appointments' ? 'active' : ''} onClick={() => setTab('appointments')}>All Appointments</button>
      </div>

      {tab === 'overview' && summary && (
        <div className="stat-grid">
          <div className="stat-card"><span>{summary.totalDoctors}</span>Doctors</div>
          <div className="stat-card"><span>{summary.totalPatients}</span>Patients</div>
          <div className="stat-card"><span>{summary.totalAppointments}</span>Appointments</div>
          <div className="stat-card"><span>Rs. {summary.totalRevenue}</span>Revenue Collected</div>
          <div className="stat-card wide">
            <h3>Appointments by status</h3>
            {Object.entries(summary.byStatus).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
          </div>
          <div className="stat-card wide">
            <h3>Top doctors by appointments</h3>
            {summary.topDoctors.map(d => <div key={d.doctorId}>{d.name}: {d.count}</div>)}
          </div>
        </div>
      )}

      {tab === 'sessions' && <SessionBoard />}

      {tab === 'centers' && <CenterManager onChanged={refresh} />}

      {tab === 'doctors' && (
        <DoctorManager specialties={specialties} onChanged={refresh} />
      )}

      {tab === 'specialties' && (
        <>
          <NewSpecialty onDone={refresh} />
          <div className="admin-table">
            {specialties.map(s => (
              <div key={s.id} className="admin-row"><div>{s.name}</div></div>
            ))}
          </div>
        </>
      )}

      {tab === 'schedules' && <ScheduleManager doctors={doctors} />}

      {tab === 'appointments' && (
        <div className="admin-table">
          {appointments.map(a => (
            <div key={a.id} className="admin-row">
              <div>
                {a.date} &middot; {a.doctorName} &middot; {a.patientName} &middot; No. {a.queueNo} &middot; {a.status} &middot; {a.paymentStatus}
                {a.refNo && <div className="meta">Ref {a.refNo} &middot; {a.source === 'counter' ? 'Counter' : 'Online'}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
