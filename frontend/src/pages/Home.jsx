import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { localISODate } from '../utils/format';

export default function Home() {
  const [specialties, setSpecialties] = useState([]);
  const [centers, setCenters] = useState([]);
  const [search, setSearch] = useState({ q: '', specialtyId: '', centerId: '', date: '' });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/doctors/specialties').then(res => setSpecialties(res.data)).catch(() => {});
    api.get('/centers').then(res => setCenters(res.data)).catch(() => {});
  }, []);

  function update(field) {
    return e => setSearch({ ...search, [field]: e.target.value });
  }

  function goSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    Object.entries(search).forEach(([key, value]) => { if (value) params.set(key, value); });
    const query = params.toString();
    navigate(`/doctors${query ? `?${query}` : ''}`);
  }

  return (
    <div className="home">
      <section className="hero-banner">
        <h1>Channel your doctor online</h1>
        <p>Find a session at a centre near you, get your appointment number, and track the queue live.</p>
      </section>

      <form className="channel-search" onSubmit={goSearch}>
        <label>
          Doctor
          <input placeholder="Doctor's name" value={search.q} onChange={update('q')} />
        </label>
        <label>
          Specialty
          <select value={search.specialtyId} onChange={update('specialtyId')}>
            <option value="">Any specialty</option>
            {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          Centre
          <select value={search.centerId} onChange={update('centerId')}>
            <option value="">Any centre</option>
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          Date
          <input type="date" min={localISODate()} value={search.date} onChange={update('date')} />
        </label>
        <button type="submit" className="primary-btn">Search</button>
      </form>

      <section className="specialty-grid">
        <h2>Browse by specialty</h2>
        <div className="grid">
          {specialties.map(s => (
            <button
              key={s.id}
              className="specialty-card"
              onClick={() => navigate(`/doctors?specialtyId=${s.id}`)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {centers.length > 0 && (
        <section className="specialty-grid">
          <h2>Our channeling centres</h2>
          <div className="center-grid">
            {centers.map(c => (
              <Link key={c.id} to={`/doctors?centerId=${c.id}`} className="center-card">
                <h3>{c.name}</h3>
                {c.address && <p className="meta">{c.address}</p>}
                {c.phone && <p className="meta">{c.phone}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="how-it-works">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step"><span>1</span>Search by doctor, specialty, centre or date</div>
          <div className="step"><span>2</span>Pick a session and enter the patient's details</div>
          <div className="step"><span>3</span>Get your appointment number and receipt</div>
          <div className="step"><span>4</span>Watch the <Link to="/live">live queue</Link> and arrive on time</div>
        </div>
      </section>
    </div>
  );
}
