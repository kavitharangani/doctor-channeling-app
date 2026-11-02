const express = require('express');
const store = require('../db/store');
const { authRequired, requireRole } = require('../middleware/auth');
const {
  DOCTOR_STATUSES, appointmentsFor, buildSession, createAppointment, listSessions,
  notify, parsePatient, saveSessionRecord, toISODate
} = require('../lib/sessions');

const router = express.Router();

// GET /api/sessions?doctorId=&centerId=&specialtyId=&q=&date=&includeEnded=1
router.get('/', (req, res) => {
  const { doctorId, centerId, specialtyId, q, date, includeEnded } = req.query;
  res.json(listSessions({ doctorId, centerId, specialtyId, q, date, includeEnded: includeEnded === '1' }));
});

// GET /api/sessions/live (public queue board for today)
router.get('/live', (req, res) => {
  res.json(listSessions({ date: toISODate(new Date()), includeEnded: true }));
});

// ---- Front desk (admin) ----
const staff = [authRequired, requireRole('admin')];

function loadSession(req, res, next) {
  const schedule = store.findById('schedules', req.params.scheduleId);
  const session = schedule && buildSession(schedule, req.params.date);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  req.schedule = schedule;
  req.session = session;
  next();
}

function activeBookings(req) {
  return appointmentsFor(req.schedule.id, req.params.date).filter(a => a.status === 'booked');
}

router.get('/:scheduleId/:date/appointments', staff, loadSession, (req, res) => {
  const appts = appointmentsFor(req.schedule.id, req.params.date).sort((a, b) => a.queueNo - b.queueNo);
  res.json(appts);
});

router.patch('/:scheduleId/:date', staff, loadSession, (req, res) => {
  const { doctorStatus, delayMinutes, note } = req.body;
  const patch = {};
  if (doctorStatus !== undefined) {
    if (!DOCTOR_STATUSES.includes(doctorStatus)) return res.status(400).json({ error: 'Unknown doctor status' });
    patch.doctorStatus = doctorStatus;
  }
  if (delayMinutes !== undefined) {
    const minutes = Number(delayMinutes);
    if (!(minutes >= 0)) return res.status(400).json({ error: 'Delay must be zero or more minutes' });
    patch.delayMinutes = minutes;
  }
  if (note !== undefined) patch.note = String(note).trim();
  saveSessionRecord(req.schedule.id, req.params.date, patch);

  if (patch.doctorStatus === 'delayed' && req.session.doctorStatus !== 'delayed') {
    const by = patch.delayMinutes ? ` by about ${patch.delayMinutes} minutes` : '';
    activeBookings(req).forEach(a => notify(
      a.patientId,
      `${req.session.doctorName}'s session on ${req.params.date} at ${req.session.centerName} is delayed${by}.`
    ));
  }
  res.json(buildSession(req.schedule, req.params.date));
});

// Moves the "now serving" number to the next (or previous) waiting patient.
router.post('/:scheduleId/:date/call', staff, loadSession, (req, res) => {
  const numbers = activeBookings(req).map(a => a.queueNo).concat(
    appointmentsFor(req.schedule.id, req.params.date)
      .filter(a => a.status === 'completed' || a.status === 'no-show')
      .map(a => a.queueNo)
  ).sort((a, b) => a - b);
  const current = req.session.nowServing;
  const target = req.body.direction === 'back'
    ? [...numbers].reverse().find(n => n < current) || 0
    : numbers.find(n => n > current);
  if (target === undefined) return res.status(409).json({ error: 'No more patients in this session' });
  saveSessionRecord(req.schedule.id, req.params.date, { nowServing: target });
  res.json(buildSession(req.schedule, req.params.date));
});

router.post('/:scheduleId/:date/cancel', staff, loadSession, (req, res) => {
  const reason = String(req.body.reason || '').trim();
  saveSessionRecord(req.schedule.id, req.params.date, { cancelled: true, note: reason });
  activeBookings(req).forEach(a => {
    store.update('appointments', a.id, {
      status: 'cancelled',
      paymentStatus: a.paymentStatus === 'paid' ? 'refund-due' : a.paymentStatus
    });
    const why = reason ? ` Reason: ${reason}.` : '';
    notify(a.patientId, `${req.session.doctorName}'s session on ${req.params.date} at ${req.session.centerName} was cancelled.${why}`);
  });
  res.json(buildSession(req.schedule, req.params.date));
});

// Reopens bookings only. Appointments cancelled with the session stay cancelled.
router.post('/:scheduleId/:date/reopen', staff, loadSession, (req, res) => {
  saveSessionRecord(req.schedule.id, req.params.date, { cancelled: false, note: '' });
  res.json(buildSession(req.schedule, req.params.date));
});

// Counter booking for a walk-in patient, with or without an online account.
router.post('/:scheduleId/:date/bookings', staff, loadSession, (req, res) => {
  const { error: patientError, patient } = parsePatient(req.body.patient);
  if (patientError) return res.status(400).json({ error: patientError });
  const { error, status, appt } = createAppointment({
    schedule: req.schedule,
    date: req.params.date,
    patient,
    source: 'counter',
    paid: Boolean(req.body.paid),
    notes: req.body.notes
  });
  if (error) return res.status(status).json({ error });
  res.status(201).json(appt);
});

module.exports = router;
