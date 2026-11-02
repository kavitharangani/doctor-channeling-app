const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const store = require('../db/store');
const { authRequired, requireRole } = require('../middleware/auth');
const { doctorWithMeta } = require('./doctors');
const { toISODate } = require('../lib/sessions');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

// ---- Specialties ----
router.post('/specialties', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const sp = { id: uuid(), name };
  store.insert('specialties', sp);
  res.status(201).json(sp);
});

router.delete('/specialties/:id', (req, res) => {
  store.remove('specialties', req.params.id);
  res.json({ ok: true });
});

// ---- Doctors (creates linked login account too) ----
const MIN_PASSWORD_LENGTH = 6;

// Validates submitted doctor details and returns only the fields that may be saved.
function parseDoctorInput(body, ownUserId = null) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const { specialtyId, password } = body;
  if (!name || !email || !specialtyId) {
    return { error: 'name, email, specialtyId are required' };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: 'Enter a valid email address' };
  }
  if (!store.findById('specialties', specialtyId)) {
    return { error: 'Specialty not found' };
  }
  if (password && String(password).length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  const experienceYears = Number(body.experienceYears || 0);
  const consultationFee = Number(body.consultationFee || 0);
  if (!(experienceYears >= 0) || !(consultationFee >= 0)) {
    return { error: 'Experience and fee must be zero or more' };
  }
  const emailTaken = store.getAll('users')
    .some(u => u.id !== ownUserId && u.email.toLowerCase() === email.toLowerCase());
  if (emailTaken) return { error: 'Email already registered', status: 409 };

  return {
    email,
    fields: {
      name,
      specialtyId,
      qualifications: String(body.qualifications || '').trim(),
      experienceYears,
      consultationFee,
      bio: String(body.bio || '').trim()
    }
  };
}

function doctorForAdmin(doc) {
  const user = store.findById('users', doc.userId);
  return {
    ...doctorWithMeta(doc),
    email: user ? user.email : '',
    schedules: store.getAll('schedules')
      .filter(s => s.doctorId === doc.id)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  };
}

// Unlike the public list, this includes deactivated doctors.
router.get('/doctors', (req, res) => {
  res.json(store.getAll('doctors').map(doctorForAdmin));
});

router.post('/doctors', (req, res) => {
  const { error, status, email, fields } = parseDoctorInput(req.body);
  if (error) return res.status(status || 400).json({ error });
  if (!req.body.password) return res.status(400).json({ error: 'password is required' });

  const doctorId = uuid();
  const user = {
    id: uuid(),
    role: 'doctor',
    name: fields.name,
    email,
    phone: '',
    doctorId,
    passwordHash: bcrypt.hashSync(String(req.body.password), 10),
    createdAt: new Date().toISOString()
  };
  store.insert('users', user);

  const doctor = { id: doctorId, userId: user.id, ...fields, photo: '', active: true };
  store.insert('doctors', doctor);
  res.status(201).json(doctorForAdmin(doctor));
});

// Password is optional here: it only changes when a new one is sent.
router.put('/doctors/:id', (req, res) => {
  const doctor = store.findById('doctors', req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  const { error, status, email, fields } = parseDoctorInput(req.body, doctor.userId);
  if (error) return res.status(status || 400).json({ error });

  const userPatch = { name: fields.name, email };
  if (req.body.password) userPatch.passwordHash = bcrypt.hashSync(String(req.body.password), 10);
  store.update('users', doctor.userId, userPatch);
  res.json(doctorForAdmin(store.update('doctors', doctor.id, fields)));
});

router.delete('/doctors/:id', (req, res) => {
  const doctor = store.findById('doctors', req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  store.update('doctors', doctor.id, { active: false });
  res.json({ ok: true });
});

router.post('/doctors/:id/activate', (req, res) => {
  const updated = store.update('doctors', req.params.id, { active: true });
  if (!updated) return res.status(404).json({ error: 'Doctor not found' });
  res.json(doctorForAdmin(updated));
});

// ---- Channeling centres ----
function parseCenterInput(body) {
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Centre name is required' };
  const hospitalFee = Number(body.hospitalFee || 0);
  const bookingFee = Number(body.bookingFee || 0);
  if (!(hospitalFee >= 0) || !(bookingFee >= 0)) return { error: 'Fees must be zero or more' };
  return {
    fields: {
      name,
      city: String(body.city || '').trim(),
      address: String(body.address || '').trim(),
      phone: String(body.phone || '').trim(),
      hospitalFee,
      bookingFee
    }
  };
}

// Unlike the public list, this includes deactivated centres.
router.get('/centers', (req, res) => {
  res.json(store.getAll('centers'));
});

router.post('/centers', (req, res) => {
  const { error, fields } = parseCenterInput(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(store.insert('centers', { id: uuid(), ...fields, active: true }));
});

router.put('/centers/:id', (req, res) => {
  const { error, fields } = parseCenterInput(req.body);
  if (error) return res.status(400).json({ error });
  const updated = store.update('centers', req.params.id, { ...fields, active: req.body.active !== false });
  if (!updated) return res.status(404).json({ error: 'Centre not found' });
  res.json(updated);
});

// ---- Schedules ----
function scheduleForAdmin(schedule) {
  const doctor = store.findById('doctors', schedule.doctorId);
  const center = store.findById('centers', schedule.centerId);
  return {
    ...schedule,
    doctorName: doctor ? doctor.name : 'Unknown',
    centerName: center ? center.name : schedule.location
  };
}

router.get('/schedules', (req, res) => {
  res.json(store.getAll('schedules').map(scheduleForAdmin));
});

router.post('/schedules', (req, res) => {
  const { doctorId, centerId, dayOfWeek, startTime, endTime, slotMinutes } = req.body;
  if (!doctorId || !centerId || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({ error: 'doctorId, centerId, dayOfWeek, startTime, endTime are required' });
  }
  const center = store.findById('centers', centerId);
  if (!center) return res.status(404).json({ error: 'Centre not found' });
  if (!store.findById('doctors', doctorId)) return res.status(404).json({ error: 'Doctor not found' });
  if (endTime <= startTime) return res.status(400).json({ error: 'End time must be after start time' });
  const minutes = Number(slotMinutes || 10);
  if (!(minutes > 0)) return res.status(400).json({ error: 'Minutes per patient must be more than zero' });
  const sch = {
    id: uuid(), doctorId, centerId, dayOfWeek: Number(dayOfWeek), startTime, endTime,
    slotMinutes: minutes, location: center.name
  };
  store.insert('schedules', sch);
  res.status(201).json(scheduleForAdmin(sch));
});

router.delete('/schedules/:id', (req, res) => {
  const today = toISODate(new Date());
  const hasBookings = store.getAll('appointments')
    .some(a => a.scheduleId === req.params.id && a.status === 'booked' && a.date >= today);
  if (hasBookings) {
    return res.status(409).json({ error: 'This schedule has upcoming bookings. Cancel those sessions first.' });
  }
  store.remove('schedules', req.params.id);
  res.json({ ok: true });
});

// PATCH /api/admin/appointments/:id/payment (cash at the counter, refunds)
router.patch('/appointments/:id/payment', (req, res) => {
  const { paymentStatus } = req.body;
  if (!['paid', 'refunded'].includes(paymentStatus)) {
    return res.status(400).json({ error: 'paymentStatus must be paid or refunded' });
  }
  const updated = store.update('appointments', req.params.id, { paymentStatus });
  if (!updated) return res.status(404).json({ error: 'Appointment not found' });
  res.json(updated);
});

// ---- Users / Appointments overview ----
router.get('/users', (req, res) => {
  res.json(store.getAll('users').map(({ passwordHash, ...u }) => u));
});

router.get('/appointments', (req, res) => {
  const appts = store.getAll('appointments').map(a => {
    const doctor = store.findById('doctors', a.doctorId);
    const patient = store.findById('users', a.patientId);
    const patientName = a.patientDetails ? a.patientDetails.name : (patient ? patient.name : '');
    return { ...a, doctorName: doctor ? doctor.name : '', patientName };
  });
  res.json(appts);
});

// ---- Reports / analytics ----
router.get('/reports/summary', (req, res) => {
  const appts = store.getAll('appointments');
  const doctors = store.getAll('doctors').filter(d => d.active !== false);
  const patients = store.getAll('users').filter(u => u.role === 'patient');

  const totalRevenue = appts
    .filter(a => a.paymentStatus === 'paid')
    .reduce((sum, a) => sum + (a.amount || 0), 0);

  const byStatus = appts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const apptsByDoctor = {};
  appts.forEach(a => {
    apptsByDoctor[a.doctorId] = (apptsByDoctor[a.doctorId] || 0) + 1;
  });
  const topDoctors = Object.entries(apptsByDoctor)
    .map(([doctorId, count]) => {
      const d = store.findById('doctors', doctorId);
      return { doctorId, name: d ? d.name : 'Unknown', count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    totalDoctors: doctors.length,
    totalPatients: patients.length,
    totalAppointments: appts.length,
    totalRevenue,
    byStatus,
    topDoctors
  });
});

module.exports = router;
