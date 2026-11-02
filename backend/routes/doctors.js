const express = require('express');
const store = require('../db/store');
const { listSessions } = require('../lib/sessions');

const router = express.Router();

function doctorWithMeta(doc) {
  const reviews = store.getAll('reviews').filter(r => r.doctorId === doc.id);
  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;
  const specialty = store.findById('specialties', doc.specialtyId);
  return {
    ...doc,
    specialtyName: specialty ? specialty.name : 'General',
    avgRating,
    reviewCount: reviews.length
  };
}

// GET /api/specialties
router.get('/specialties', (req, res) => {
  res.json(store.getAll('specialties'));
});

// GET /api/doctors?specialtyId=&q=&centerId=&date=
// Each doctor comes with their next bookable session. Choosing a centre or date
// only keeps doctors who sit there or then.
router.get('/', (req, res) => {
  const { specialtyId, q, centerId, date } = req.query;
  let doctors = store.getAll('doctors').filter(d => d.active !== false);
  if (specialtyId) doctors = doctors.filter(d => d.specialtyId === specialtyId);
  if (q) {
    const needle = q.toLowerCase();
    doctors = doctors.filter(d => d.name.toLowerCase().includes(needle));
  }
  const withSessions = doctors.map(doc => {
    const sessions = listSessions({ doctorId: doc.id, centerId, date, days: 30 });
    const nextSession = sessions.find(s => s.status === 'available') || null;
    return { ...doctorWithMeta(doc), nextSession, sessionCount: sessions.length };
  });
  const filtered = centerId || date ? withSessions.filter(d => d.sessionCount > 0) : withSessions;
  res.json(filtered);
});

// GET /api/doctors/:id
router.get('/:id', (req, res) => {
  const doc = store.findById('doctors', req.params.id);
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  const schedules = store.getAll('schedules').filter(s => s.doctorId === doc.id);
  const reviews = store.getAll('reviews')
    .filter(r => r.doctorId === doc.id)
    .map(r => {
      const patient = store.findById('users', r.patientId);
      return { ...r, patientName: patient ? patient.name : 'Patient' };
    });
  res.json({ ...doctorWithMeta(doc), schedules, reviews });
});

module.exports = router;
module.exports.doctorWithMeta = doctorWithMeta;
