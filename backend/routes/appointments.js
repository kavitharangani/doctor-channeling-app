const express = require('express');
const store = require('../db/store');
const { authRequired, requireRole } = require('../middleware/auth');
const {
  buildSession, createAppointment, estimatedTime, normalizePhone, notify, parsePatient, sessionRecord
} = require('../lib/sessions');

const router = express.Router();

function enrich(appt) {
  const doctor = store.findById('doctors', appt.doctorId);
  const patient = store.findById('users', appt.patientId);
  const schedule = store.findById('schedules', appt.scheduleId);
  const center = store.findById('centers', appt.centerId || (schedule && schedule.centerId));
  const record = sessionRecord(appt.scheduleId, appt.date) || {};
  const details = appt.patientDetails || {};
  return {
    ...appt,
    doctorName: doctor ? doctor.name : 'Unknown',
    patientName: details.name || (patient ? patient.name : 'Unknown'),
    patientPhone: details.phone || (patient ? patient.phone : ''),
    location: center ? center.name : (schedule ? schedule.location : ''),
    centerCity: center ? center.city : '',
    centerAddress: center ? center.address : '',
    centerPhone: center ? center.phone : '',
    scheduleTime: schedule ? `${schedule.startTime} - ${schedule.endTime}` : '',
    estimatedTime: schedule ? estimatedTime(schedule, appt.queueNo, record.delayMinutes || 0) : appt.time,
    nowServing: record.nowServing || 0,
    doctorStatus: record.doctorStatus || 'scheduled',
    delayMinutes: record.delayMinutes || 0
  };
}

// A paid appointment that gets cancelled is owed its money back.
function cancelledPatch(appt) {
  return {
    status: 'cancelled',
    paymentStatus: appt.paymentStatus === 'paid' ? 'refund-due' : appt.paymentStatus
  };
}

// POST /api/appointments  (patient books)
router.post('/', authRequired, requireRole('patient'), (req, res) => {
  const { scheduleId, date, notes } = req.body;
  if (!scheduleId || !date) {
    return res.status(400).json({ error: 'scheduleId, date are required' });
  }
  const schedule = store.findById('schedules', scheduleId);
  if (!schedule) return res.status(404).json({ error: 'Session not found' });

  const { error: patientError, patient } = parsePatient(req.body.patient);
  if (patientError) return res.status(400).json({ error: patientError });

  const { error, status, appt } = createAppointment({
    schedule, date, patient, patientId: req.user.id, source: 'online', notes
  });
  if (error) return res.status(status).json({ error });
  res.status(201).json(enrich(appt));
});

// POST /api/appointments/track  (public: reference number + phone, no login)
router.post('/track', (req, res) => {
  const refNo = String(req.body.refNo || '').trim().toUpperCase();
  const phone = normalizePhone(req.body.phone);
  const appt = store.getAll('appointments').find(a => a.refNo === refNo);
  if (!appt || !phone || normalizePhone(enrich(appt).patientPhone) !== phone) {
    return res.status(404).json({ error: 'No appointment matches that reference and phone number' });
  }
  const full = enrich(appt);
  const schedule = store.findById('schedules', appt.scheduleId);
  const session = schedule && buildSession(schedule, appt.date);
  res.json({
    refNo: full.refNo,
    doctorName: full.doctorName,
    location: full.location,
    date: full.date,
    scheduleTime: full.scheduleTime,
    estimatedTime: full.estimatedTime,
    queueNo: full.queueNo,
    status: full.status,
    paymentStatus: full.paymentStatus,
    nowServing: full.nowServing,
    doctorStatus: full.doctorStatus,
    delayMinutes: full.delayMinutes,
    sessionStatus: session ? session.status : 'ended'
  });
});

// GET /api/appointments/mine (patient's own)
router.get('/mine', authRequired, requireRole('patient'), (req, res) => {
  const appts = store.getAll('appointments').filter(a => a.patientId === req.user.id);
  appts.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).reverse();
  res.json(appts.map(enrich));
});

// GET /api/appointments/doctor?date=YYYY-MM-DD (doctor's own queue/schedule)
router.get('/doctor', authRequired, requireRole('doctor'), (req, res) => {
  const doctor = store.getAll('doctors').find(d => d.userId === req.user.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor profile not found for this user' });
  let appts = store.getAll('appointments').filter(a => a.doctorId === doctor.id);
  if (req.query.date) appts = appts.filter(a => a.date === req.query.date);
  appts.sort((a, b) => (a.date + String(a.queueNo).padStart(4, '0')).localeCompare(b.date + String(b.queueNo).padStart(4, '0')));
  res.json(appts.map(enrich));
});

// GET /api/appointments/:id (receipt)
router.get('/:id', authRequired, (req, res) => {
  const appt = store.findById('appointments', req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const doctor = store.findById('doctors', appt.doctorId);
  const isOwnerPatient = req.user.role === 'patient' && appt.patientId === req.user.id;
  const isOwnerDoctor = req.user.role === 'doctor' && doctor && doctor.userId === req.user.id;
  if (!isOwnerPatient && !isOwnerDoctor && req.user.role !== 'admin') {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  res.json(enrich(appt));
});

// PATCH /api/appointments/:id/cancel
router.patch('/:id/cancel', authRequired, (req, res) => {
  const appt = store.findById('appointments', req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const doctor = store.findById('doctors', appt.doctorId);
  const isOwnerPatient = req.user.role === 'patient' && appt.patientId === req.user.id;
  const isOwnerDoctor = req.user.role === 'doctor' && doctor && doctor.userId === req.user.id;
  if (!isOwnerPatient && !isOwnerDoctor && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not allowed to cancel this appointment' });
  }
  if (appt.status !== 'booked') return res.status(409).json({ error: 'Only a booked appointment can be cancelled' });
  const updated = store.update('appointments', appt.id, cancelledPatch(appt));
  notify(appt.patientId, `Your appointment on ${appt.date} was cancelled.`);
  if (doctor && doctor.userId) notify(doctor.userId, `Appointment on ${appt.date} (No. ${appt.queueNo}) was cancelled.`);
  res.json(enrich(updated));
});

// PATCH /api/appointments/:id/pay  (mock payment gateway)
router.patch('/:id/pay', authRequired, requireRole('patient'), (req, res) => {
  const appt = store.findById('appointments', req.params.id);
  if (!appt || appt.patientId !== req.user.id) return res.status(404).json({ error: 'Appointment not found' });
  if (appt.status !== 'booked') return res.status(409).json({ error: 'This appointment can no longer be paid for' });
  const updated = store.update('appointments', appt.id, { paymentStatus: 'paid' });
  res.json(enrich(updated));
});

// PATCH /api/appointments/:id/complete (doctor marks visit done)
router.patch('/:id/complete', authRequired, requireRole('doctor'), (req, res) => {
  const appt = store.findById('appointments', req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const doctor = store.findById('doctors', appt.doctorId);
  if (!doctor || doctor.userId !== req.user.id) return res.status(403).json({ error: 'Not your appointment' });
  const updated = store.update('appointments', appt.id, { status: 'completed' });
  notify(appt.patientId, `Your visit with ${doctor.name} on ${appt.date} is complete.`);
  res.json(enrich(updated));
});

// PATCH /api/appointments/:id/no-show (doctor marks patient absent)
router.patch('/:id/no-show', authRequired, requireRole('doctor'), (req, res) => {
  const appt = store.findById('appointments', req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const doctor = store.findById('doctors', appt.doctorId);
  if (!doctor || doctor.userId !== req.user.id) return res.status(403).json({ error: 'Not your appointment' });
  const updated = store.update('appointments', appt.id, { status: 'no-show' });
  res.json(enrich(updated));
});

module.exports = router;
