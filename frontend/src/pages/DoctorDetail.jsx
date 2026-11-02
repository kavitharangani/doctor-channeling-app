import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import SessionCard from '../components/SessionCard';

export default function DoctorDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/sessions', { params: { doctorId: id } }).then(res => setSessions(res.data)).catch(() => {});
    api.get(`/doctors/${id}`).then(res => setDoctor(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!doctor) return <p>Doctor not found.</p>;

  const canBook = !user || user.role === 'patient';

  function book(session) {
    navigate(`/doctors/${doctor.id}/book?scheduleId=${session.scheduleId}&date=${session.date}`);
  }

  return (
    <div className="doctor-detail">
      <div className="doctor-detail-header">
        <div className="doctor-avatar large">{doctor.name.replace(/^dr\.?\s+/i, '').split(' ').map(p => p[0]).slice(0, 2).join('')}</div>
        <div>
          <h1>{doctor.name}</h1>
          <p className="specialty">{doctor.specialtyName}</p>
          <p className="meta">{doctor.qualifications}</p>
          <p className="meta">{doctor.experienceYears} years of experience</p>
          <p className="rating">
            {doctor.avgRating ? `★ ${doctor.avgRating} (${doctor.reviewCount} reviews)` : 'No reviews yet'}
          </p>
        </div>
      </div>

      <section className="doctor-schedule">
        <h2>Upcoming sessions</h2>
        {sessions.length === 0 ? <p>No sessions in the next two weeks.</p> : (
          <div className="session-list">
            {sessions.map(s => (
              <SessionCard
                key={`${s.scheduleId}-${s.date}`}
                session={s}
                actionLabel="Book"
                onAction={canBook ? book : null}
              />
            ))}
          </div>
        )}
      </section>

      {doctor.bio && (
        <section className="doctor-bio">
          <h2>About</h2>
          <p>{doctor.bio}</p>
        </section>
      )}

      <section className="doctor-reviews">
        <h2>Patient Reviews</h2>
        {doctor.reviews.length === 0 ? <p>No reviews yet.</p> : (
          <ul className="review-list">
            {doctor.reviews.map(r => (
              <li key={r.id}>
                <strong>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong> — {r.patientName}
                {r.comment && <p>{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
