const express = require('express');
const { v4: uuid } = require('uuid');
const store = require('../db/store');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews (patient rates doctor after a completed appointment)
router.post('/', authRequired, requireRole('patient'), (req, res) => {
  const { appointmentId, rating, comment } = req.body;
  const appt = store.findById('appointments', appointmentId);
  if (!appt || appt.patientId !== req.user.id) return res.status(404).json({ error: 'Appointment not found' });
  if (appt.status !== 'completed') return res.status(400).json({ error: 'Can only review completed appointments' });
  if (store.getAll('reviews').find(r => r.appointmentId === appointmentId)) {
    return res.status(409).json({ error: 'Appointment already reviewed' });
  }
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });

  const review = {
    id: uuid(),
    doctorId: appt.doctorId,
    patientId: req.user.id,
    appointmentId,
    rating,
    comment: comment || '',
    createdAt: new Date().toISOString()
  };
  store.insert('reviews', review);
  res.status(201).json(review);
});

// GET /api/reviews/doctor/:doctorId
router.get('/doctor/:doctorId', (req, res) => {
  const reviews = store.getAll('reviews').filter(r => r.doctorId === req.params.doctorId);
  res.json(reviews);
});

module.exports = router;
