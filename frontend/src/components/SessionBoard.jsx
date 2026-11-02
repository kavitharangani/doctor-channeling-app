import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { DOCTOR_STATUS_LABELS, formatTime, localISODate, money } from '../utils/format';

const EMPTY_WALK_IN = { name: '', phone: '', nic: '', paid: true };

function SessionPanel({ session, onChanged }) {
  const [open, setOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [delay, setDelay] = useState(session.delayMinutes || '');
  const [walkIn, setWalkIn] = useState(EMPTY_WALK_IN);
  const [error, setError] = useState('');
  const base = `/sessions/${session.scheduleId}/${session.date}`;

  function loadBookings() {
    return api.get(`${base}/appointments`).then(res => setBookings(res.data));
  }

  useEffect(() => {
    if (open) loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function run(action) {
    setError('');
    try {
      await action();
      onChanged();
      if (open) await loadBookings();
    } catch (err) {
      setError(err.response?.data?.error || 'That did not work. Please try again.');
    }
  }

  function setDoctorStatus(doctorStatus) {
    const body = { doctorStatus };
    if (doctorStatus === 'delayed') body.delayMinutes = Number(delay) || 0;
    if (doctorStatus === 'arrived') body.delayMinutes = 0;
    run(() => api.patch(base, body));
  }

  function cancelSession() {
    const reason = prompt(`Cancel this session? All ${session.booked} bookings will be cancelled and patients notified.\n\nReason:`);
    if (reason === null) return;
    run(() => api.post(`${base}/cancel`, { reason }));
  }

  function addWalkIn(e) {
    e.preventDefault();
    const { paid, ...patient } = walkIn;
    run(async () => {
      await api.post(`${base}/bookings`, { patient, paid });
      setWalkIn(EMPTY_WALK_IN);
    });
  }

  const cancelled = session.status === 'cancelled';
  const ended = session.status === 'ended';

  return (
    <article className={`board-card ${session.status}`}>
      <div className="board-top">
        <div className="live-now">
          <span>Now serving</span>
          <strong>{session.nowServing || '–'}</strong>
        </div>
        <div className="board-info">
          <h3>{session.doctorName}</h3>
          <p className="meta">{session.specialtyName} &middot; {session.centerName}</p>
          <p className="meta">
            {formatTime(session.startTime)} to {formatTime(session.endTime)} &middot; {session.booked} of {session.capacity} booked
          </p>
          <p className={`doctor-state ${cancelled ? 'cancelled' : session.doctorStatus}`}>
            {cancelled ? `Cancelled${session.note ? `: ${session.note}` : ''}` : DOCTOR_STATUS_LABELS[session.doctorStatus]}
          </p>
        </div>
        <button className="link-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Close' : `Manage (${session.booked})`}
        </button>
      </div>

      {error && <div className="error-banner" role="alert">{error}</div>}

      {!cancelled && !ended && (
        <div className="board-actions">
          <button className="primary-btn" onClick={() => run(() => api.post(`${base}/call`, { direction: 'next' }))}>Call next</button>
          <button className="secondary-btn" onClick={() => run(() => api.post(`${base}/call`, { direction: 'back' }))}>Back</button>
          <button className="secondary-btn" onClick={() => setDoctorStatus('arrived')}>Doctor arrived</button>
          <span className="delay-group">
            <input
              type="number"
              min="0"
              aria-label="Delay in minutes"
              placeholder="Mins"
              value={delay}
              onChange={e => setDelay(e.target.value)}
            />
            <button className="secondary-btn" onClick={() => setDoctorStatus('delayed')}>Delayed</button>
          </span>
          <button className="secondary-btn" onClick={() => setDoctorStatus('finished')}>Finish</button>
          <button className="danger-btn" onClick={cancelSession}>Cancel session</button>
        </div>
      )}
      {cancelled && (
        <div className="board-actions">
          <button className="secondary-btn" onClick={() => run(() => api.post(`${base}/reopen`))}>Reopen for new bookings</button>
        </div>
      )}

      {open && (
        <div className="board-details">
          {session.status === 'available' && (
            <form className="walk-in" onSubmit={addWalkIn}>
              <h4>Counter booking (No. {session.nextNo}, {money(session.fees.total)})</h4>
              <div className="walk-in-fields">
                <input aria-label="Patient name" placeholder="Patient name" value={walkIn.name} onChange={e => setWalkIn({ ...walkIn, name: e.target.value })} required />
                <input aria-label="Mobile number" type="tel" placeholder="Mobile number" value={walkIn.phone} onChange={e => setWalkIn({ ...walkIn, phone: e.target.value })} required />
                <input aria-label="NIC" placeholder="NIC (optional)" value={walkIn.nic} onChange={e => setWalkIn({ ...walkIn, nic: e.target.value })} />
                <label className="check-label">
                  <input type="checkbox" checked={walkIn.paid} onChange={e => setWalkIn({ ...walkIn, paid: e.target.checked })} />
                  Paid in cash
                </label>
                <button type="submit" className="primary-btn">Book</button>
              </div>
            </form>
          )}

          {bookings.length === 0 ? (
            <p className="meta">No bookings yet.</p>
          ) : (
            <div className="booking-table-wrap">
              <table className="booking-table">
                <thead>
                  <tr><th>No.</th><th>Patient</th><th>Mobile</th><th>Status</th><th>Payment</th><th></th></tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} className={b.status === 'cancelled' ? 'row-cancelled' : ''}>
                      <td>{b.queueNo}</td>
                      <td><Link to={`/appointments/${b.id}`}>{b.patientDetails?.name || 'Patient'}</Link></td>
                      <td>{b.patientDetails?.phone}</td>
                      <td>{b.status}</td>
                      <td>{b.paymentStatus}</td>
                      <td className="row-actions">
                        {b.status === 'booked' && b.paymentStatus === 'pending' && (
                          <button className="link-btn" onClick={() => run(() => api.patch(`/admin/appointments/${b.id}/payment`, { paymentStatus: 'paid' }))}>Mark paid</button>
                        )}
                        {b.paymentStatus === 'refund-due' && (
                          <button className="link-btn" onClick={() => run(() => api.patch(`/admin/appointments/${b.id}/payment`, { paymentStatus: 'refunded' }))}>Mark refunded</button>
                        )}
                        {b.status === 'booked' && (
                          <button className="link-btn danger-link" onClick={() => { if (confirm(`Cancel No. ${b.queueNo}?`)) run(() => api.patch(`/appointments/${b.id}/cancel`)); }}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function SessionBoard() {
  const [date, setDate] = useState(localISODate());
  const [centerId, setCenterId] = useState('');
  const [centers, setCenters] = useState([]);
  const [sessions, setSessions] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.get('/centers').then(res => setCenters(res.data)).catch(() => {});
  }, []);

  function load() {
    setFailed(false);
    const params = { date, includeEnded: 1 };
    if (centerId) params.centerId = centerId;
    return api.get('/sessions', { params })
      .then(res => setSessions(res.data))
      .catch(() => setFailed(true));
  }

  useEffect(() => {
    setSessions(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, centerId]);

  return (
    <section>
      <div className="manager-filters">
        <input type="date" aria-label="Session date" className="filter-date" value={date} onChange={e => setDate(e.target.value)} />
        <select aria-label="Centre" value={centerId} onChange={e => setCenterId(e.target.value)}>
          <option value="">All centres</option>
          {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {failed ? (
        <div className="manager-empty">
          <p>Could not load sessions.</p>
          <button className="secondary-btn" onClick={load}>Try again</button>
        </div>
      ) : !sessions ? (
        <div className="page-loading">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="manager-empty"><p>No sessions on this date.</p></div>
      ) : (
        <div className="board-list">
          {sessions.map(s => <SessionPanel key={s.scheduleId} session={s} onChanged={load} />)}
        </div>
      )}
    </section>
  );
}
