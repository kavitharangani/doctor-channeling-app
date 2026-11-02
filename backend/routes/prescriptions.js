const express = require('express');
const { v4: uuid } = require('uuid');
const store = require('../db/store');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/prescriptions  (doctor adds prescription for a completed/booked appointment)
router.post('/', authRequired, requireRole('doctor'), (req, res) => {
  const { appointmentId, diagnosis, medicines, advice } = req.body;
  const appt = store.findById('appointments', appointmentId);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const doctor = store.findById('doctors', appt.doctorId);
  if (!doctor || doctor.userId !== req.user.id) return res.status(403).json({ error: 'Not your appointment' });

  const rx = {
    id: uuid(),
    appointmentId,
    doctorId: doctor.id,
    patientId: appt.patientId,
    diagnosis: diagnosis || '',
    medicines: medicines || [], // [{ name, dosage, duration }]
    advice: advice || '',
    createdAt: new Date().toISOString()
  };
  store.insert('prescriptions', rx);
  store.update('appointments', appt.id, { status: 'completed' });
  res.status(201).json(rx);
});

// GET /api/prescriptions/mine (patient)
router.get('/mine', authRequired, requireRole('patient'), (req, res) => {
  const rx = store.getAll('prescriptions').filter(r => r.patientId === req.user.id);
  const withNames = rx.map(r => {
    const doctor = store.findById('doctors', r.doctorId);
    return { ...r, doctorName: doctor ? doctor.name : 'Doctor' };
  });
  res.json(withNames);
});

// GET /api/prescriptions/appointment/:appointmentId
router.get('/appointment/:appointmentId', authRequired, (req, res) => {
  const rx = store.getAll('prescriptions').find(r => r.appointmentId === req.params.appointmentId);
  if (!rx) return res.status(404).json({ error: 'No prescription for this appointment' });
  res.json(rx);
});

module.exports = router;
