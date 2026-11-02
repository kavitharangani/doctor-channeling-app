import { useEffect, useState } from 'react';
import api from '../api';
import { DOCTOR_STATUS_LABELS, formatDate, formatTime } from '../utils/format';

const REFRESH_MS = 20000;

function TrackAppointment() {
  const [form, setForm] = useState({ refNo: '', phone: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await api.post('/appointments/track', form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not find that appointment');
    } finally {
      setBusy(false);
    }
  }

  const ahead = result ? Math.max(result.queueNo - Math.max(result.nowServing, 1), 0) : 0;

  return (
    <section className="track-panel">
      <h2>Check my appointment</h2>
      <form className="track-form" onSubmit={submit}>
        <label>
          Reference number
          <input
            value={form.refNo}
            onChange={e => setForm({ ...form, refNo: e.target.value })}
            placeholder="CH261103-AB12"
            required
          />
        </label>
        <label>
          Mobile number
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>
        <button type="submit" className="primary-btn" disabled={busy}>{busy ? 'Checking...' : 'Check'}</button>
      </form>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {result && (
        <div className="track-result">
          <h3>{result.doctorName}</h3>
          <p className="meta">{formatDate(result.date)} &middot; {result.location}</p>
          {result.status === 'cancelled' ? (
            <p className="session-warning">This appointment has been cancelled.</p>
          ) : (
            <div className="track-numbers">
              <div><span>Your number</span><strong>{result.queueNo}</strong></div>
              <div><span>Now serving</span><strong>{result.nowServing || '–'}</strong></div>
              <div><span>Estimated time</span><strong>{formatTime(result.estimatedTime)}</strong></div>
            </div>
          )}
          {result.status === 'booked' && result.nowServing > 0 && (
            <p>{ahead === 0 ? "It's your turn, or you are next." : `${ahead} ${ahead === 1 ? 'number' : 'numbers'} ahead of you.`}</p>
          )}
        </div>
      )}
    </section>
  );
}

export default function LiveQueue() {
  const [sessions, setSessions] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    function load() {
      api.get('/sessions/live')
        .then(res => { setSessions(res.data); setFailed(false); })
        .catch(() => setFailed(true));
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="live-page">
      <h1>Live Queue</h1>
      <p className="meta">Today's sessions. This page updates by itself.</p>

      <TrackAppointment />

      {failed && <div className="error-banner" role="alert">Could not refresh the queue. Retrying shortly.</div>}
      {!sessions ? (
        !failed && <div className="page-loading">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="manager-empty"><p>No sessions today.</p></div>
      ) : (
        <div className="live-grid">
          {sessions.map(s => (
            <article key={s.scheduleId} className={`live-card ${s.status}`}>
              <div className="live-now">
                <span>Now serving</span>
                <strong>{s.status === 'cancelled' ? '–' : s.nowServing || '–'}</strong>
              </div>
              <div className="live-info">
                <h3>{s.doctorName}</h3>
                <p className="specialty">{s.specialtyName}</p>
                <p className="meta">{s.centerName}</p>
                <p className="meta">{formatTime(s.startTime)} to {formatTime(s.endTime)} &middot; {s.booked} booked</p>
                {s.status === 'cancelled' ? (
                  <p className="session-warning">Session cancelled{s.note ? `: ${s.note}` : ''}</p>
                ) : (
                  <p className={`doctor-state ${s.doctorStatus}`}>
                    {DOCTOR_STATUS_LABELS[s.doctorStatus]}
                    {s.doctorStatus === 'delayed' && s.delayMinutes ? ` by about ${s.delayMinutes} minutes` : ''}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
