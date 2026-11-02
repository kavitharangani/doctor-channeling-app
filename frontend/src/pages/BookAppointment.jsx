import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import SessionCard from '../components/SessionCard';
import { formatDate, formatTime, money } from '../utils/format';

const TITLES = ['Mr', 'Mrs', 'Ms', 'Master', 'Baby', 'Rev', 'Dr'];

export default function BookAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [doctor, setDoctor] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [patient, setPatient] = useState({ title: 'Mr', name: user?.name || '', phone: user?.phone || '', nic: '' });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/doctors/${id}`).then(res => setDoctor(res.data));
    api.get('/sessions', { params: { doctorId: id } }).then(res => {
      setSessions(res.data);
      const scheduleId = params.get('scheduleId');
      const date = params.get('date');
      setSelected(res.data.find(s => s.scheduleId === scheduleId && s.date === date && s.status === 'available') || null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function update(field) {
    return e => setPatient({ ...patient, [field]: e.target.value });
  }

  async function confirmBooking(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/appointments', {
        scheduleId: selected.scheduleId,
        date: selected.date,
        patient,
        notes
      });
      navigate(`/appointments/${res.data.id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed');
      setBusy(false);
    }
  }

  if (!doctor || !sessions) return <div className="page-loading">Loading...</div>;

  return (
    <div className="book-page">
      <h1>Channel {doctor.name}</h1>
      <p className="specialty">{doctor.specialtyName}</p>

      <ol className="book-steps">
        <li className={selected ? 'done' : 'current'}>Choose session</li>
        <li className={selected ? 'current' : ''}>Patient details</li>
        <li>Receipt</li>
      </ol>

      {!selected ? (
        sessions.length === 0 ? (
          <p>No sessions in the next two weeks. <Link to="/doctors">Find another doctor</Link></p>
        ) : (
          <div className="session-list">
            {sessions.map(s => (
              <SessionCard key={`${s.scheduleId}-${s.date}`} session={s} actionLabel="Select" onAction={setSelected} />
            ))}
          </div>
        )
      ) : (
        <div className="book-layout">
          <form className="admin-form" onSubmit={confirmBooking}>
            <h2>Patient details</h2>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <div className="patient-grid">
              <label>
                Title
                <select value={patient.title} onChange={update('title')}>
                  {TITLES.map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Patient's full name
                <input value={patient.name} onChange={update('name')} required />
              </label>
              <label>
                Mobile number
                <input type="tel" value={patient.phone} onChange={update('phone')} placeholder="07X XXX XXXX" required />
              </label>
              <label>
                NIC (optional)
                <input value={patient.nic} onChange={update('nic')} placeholder="200012345678" />
              </label>
            </div>
            <label>
              Note for the doctor (optional)
              <textarea value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
            <div className="book-actions">
              <button type="button" className="secondary-btn" onClick={() => setSelected(null)}>Change session</button>
              <button type="submit" className="primary-btn" disabled={busy}>
                {busy ? 'Booking...' : 'Confirm booking'}
              </button>
            </div>
          </form>

          <aside className="book-summary">
            <h2>Your session</h2>
            <p className="session-date">{formatDate(selected.date)}</p>
            <p className="meta">{formatTime(selected.startTime)} to {formatTime(selected.endTime)}</p>
            <p className="meta">{selected.centerName}</p>
            <p className="book-number">Appointment No. <strong>{selected.nextNo}</strong></p>
            <p className="meta">Estimated time {formatTime(selected.estimatedTime)}</p>
            <dl className="fee-table">
              <div><dt>Doctor's fee</dt><dd>{money(selected.fees.doctorFee)}</dd></div>
              <div><dt>Centre fee</dt><dd>{money(selected.fees.centerFee)}</dd></div>
              <div><dt>Booking fee</dt><dd>{money(selected.fees.bookingFee)}</dd></div>
              <div className="total"><dt>Total</dt><dd>{money(selected.fees.total)}</dd></div>
            </dl>
          </aside>
        </div>
      )}
    </div>
  );
}
