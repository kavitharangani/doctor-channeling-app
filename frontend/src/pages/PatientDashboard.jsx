import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatDate, formatTime, money } from '../utils/format';

function ReviewForm({ appointmentId, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api.post('/reviews', { appointmentId, rating, comment });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="review-form">
      <select value={rating} onChange={e => setRating(Number(e.target.value))}>
        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
      </select>
      <input placeholder="Leave a comment (optional)" value={comment} onChange={e => setComment(e.target.value)} />
      <button className="secondary-btn" disabled={busy} onClick={submit}>Submit Review</button>
    </div>
  );
}

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [openReviewFor, setOpenReviewFor] = useState(null);
  const [tab, setTab] = useState('appointments');

  function refresh() {
    api.get('/appointments/mine').then(res => setAppointments(res.data));
    api.get('/prescriptions/mine').then(res => setPrescriptions(res.data));
    api.get('/notifications').then(res => setNotifications(res.data));
  }

  useEffect(() => { refresh(); }, []);

  async function cancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    await api.patch(`/appointments/${id}/cancel`);
    refresh();
  }

  async function pay(id) {
    await api.patch(`/appointments/${id}/pay`);
    refresh();
  }

  return (
    <div className="dashboard">
      <h1>My Dashboard</h1>
      <div className="tabs">
        <button className={tab === 'appointments' ? 'active' : ''} onClick={() => setTab('appointments')}>Appointments</button>
        <button className={tab === 'prescriptions' ? 'active' : ''} onClick={() => setTab('prescriptions')}>Prescriptions</button>
        <button className={tab === 'notifications' ? 'active' : ''} onClick={() => setTab('notifications')}>
          Notifications{notifications.filter(n => !n.read).length > 0 ? ` (${notifications.filter(n => !n.read).length})` : ''}
        </button>
      </div>

      {tab === 'appointments' && (
        <div className="appointment-list">
          {appointments.length === 0 && <p>No appointments yet.</p>}
          {appointments.map(a => (
            <div key={a.id} className={`appointment-card status-${a.status}`}>
              <div>
                <h3>{a.doctorName}</h3>
                <p>{formatDate(a.date)} &middot; about {formatTime(a.estimatedTime)} &middot; No. {a.queueNo}</p>
                <p className="meta">{a.location}{a.patientDetails ? ` · For ${a.patientDetails.name}` : ''}</p>
                <p>Status: <strong>{a.status}</strong> &middot; Payment: <strong>{a.paymentStatus}</strong> &middot; {money(a.amount)}</p>
                {a.refNo && <p className="meta">Ref {a.refNo}</p>}
              </div>
              <div className="appointment-actions">
                <Link className="secondary-btn" to={`/appointments/${a.id}`}>Receipt</Link>
                {a.status === 'booked' && a.paymentStatus === 'pending' && (
                  <button className="secondary-btn" onClick={() => pay(a.id)}>Pay Now</button>
                )}
                {a.status === 'booked' && (
                  <button className="danger-btn" onClick={() => cancel(a.id)}>Cancel</button>
                )}
                {a.status === 'completed' && openReviewFor !== a.id && (
                  <button className="secondary-btn" onClick={() => setOpenReviewFor(a.id)}>Leave Review</button>
                )}
              </div>
              {openReviewFor === a.id && (
                <ReviewForm appointmentId={a.id} onDone={() => { setOpenReviewFor(null); refresh(); }} />
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'prescriptions' && (
        <div className="prescription-list">
          {prescriptions.length === 0 && <p>No prescriptions yet.</p>}
          {prescriptions.map(rx => (
            <div key={rx.id} className="prescription-card">
              <h3>{rx.doctorName} &middot; {new Date(rx.createdAt).toLocaleDateString()}</h3>
              <p><strong>Diagnosis:</strong> {rx.diagnosis || '-'}</p>
              {rx.medicines?.length > 0 && (
                <ul>
                  {rx.medicines.map((m, i) => (
                    <li key={i}>{m.name} &mdash; {m.dosage} ({m.duration})</li>
                  ))}
                </ul>
              )}
              {rx.advice && <p><strong>Advice:</strong> {rx.advice}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="notification-list">
          {notifications.length === 0 && <p>No notifications.</p>}
          {notifications.map(n => (
            <div key={n.id} className={`notification-item ${n.read ? '' : 'unread'}`}>
              <p>{n.message}</p>
              <span className="meta">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
