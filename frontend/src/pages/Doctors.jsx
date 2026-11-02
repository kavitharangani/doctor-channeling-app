import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { formatDate, formatTime, localISODate, money } from '../utils/format';

export default function Doctors() {
  const [params, setParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [centers, setCenters] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const [specialtyId, setSpecialtyId] = useState(params.get('specialtyId') || '');
  const [centerId, setCenterId] = useState(params.get('centerId') || '');
  const [date, setDate] = useState(params.get('date') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/doctors/specialties').then(res => setSpecialties(res.data)).catch(() => {});
    api.get('/centers').then(res => setCenters(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = {};
    if (q) query.q = q;
    if (specialtyId) query.specialtyId = specialtyId;
    if (centerId) query.centerId = centerId;
    if (date) query.date = date;
    api.get('/doctors', { params: query })
      .then(res => setDoctors(res.data))
      .finally(() => setLoading(false));
    setParams(query, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, specialtyId, centerId, date]);

  return (
    <div className="doctors-page">
      <h1>Find a Doctor</h1>
      <div className="filters">
        <input
          type="text"
          aria-label="Search by name"
          placeholder="Search by name..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <select aria-label="Specialty" value={specialtyId} onChange={e => setSpecialtyId(e.target.value)}>
          <option value="">All specialties</option>
          {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Centre" value={centerId} onChange={e => setCenterId(e.target.value)}>
          <option value="">All centres</option>
          {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="date"
          aria-label="Session date"
          className="filter-date"
          min={localISODate()}
          value={date}
          onChange={e => setDate(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="page-loading">Loading doctors...</div>
      ) : doctors.length === 0 ? (
        <p>No doctors found for this search. Try another date or centre.</p>
      ) : (
        <div className="doctor-list">
          {doctors.map(d => (
            <Link to={`/doctors/${d.id}`} key={d.id} className="doctor-card">
              <div className="doctor-avatar">{d.name.replace(/^dr\.?\s+/i, '').split(' ').map(p => p[0]).slice(0, 2).join('')}</div>
              <div className="doctor-info">
                <h3>{d.name}</h3>
                <p className="specialty">{d.specialtyName}</p>
                <p className="meta">{d.experienceYears} yrs experience</p>
                <p className="rating">
                  {d.avgRating ? `★ ${d.avgRating} (${d.reviewCount} reviews)` : 'No reviews yet'}
                </p>
                {d.nextSession ? (
                  <div className="next-session">
                    <span className="next-label">Next session</span>
                    <span>{formatDate(d.nextSession.date)}, {formatTime(d.nextSession.startTime)}</span>
                    <span className="meta">{d.nextSession.centerName}</span>
                    <span className="session-fee">{money(d.nextSession.fees.total)}</span>
                  </div>
                ) : (
                  <p className="meta">No open sessions right now</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
