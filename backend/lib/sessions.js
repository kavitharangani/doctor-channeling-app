// A "session" is one sitting of a doctor at a centre: a weekly schedule on a
// specific date. Status set by staff (delay, cancellation, now serving) lives in
// the sessions table, which only gets a row once staff change something.
const { v4: uuid } = require('uuid');
const store = require('../db/store');

const DOCTOR_STATUSES = ['scheduled', 'arrived', 'delayed', 'finished'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toISODate(d) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function addMinutes(time, minutes) {
  const total = toMinutes(time) + minutes;
  const h = Math.floor(total / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function capacityOf(schedule) {
  const duration = Math.max(toMinutes(schedule.endTime) - toMinutes(schedule.startTime), 0);
  return Math.max(Math.floor(duration / (schedule.slotMinutes || 10)), 1);
}

function notify(userId, message) {
  if (!userId) return;
  store.insert('notifications', {
    id: uuid(), userId, message, read: false, createdAt: new Date().toISOString()
  });
}

function sessionRecord(scheduleId, date) {
  return store.getAll('sessions').find(s => s.scheduleId === scheduleId && s.date === date) || null;
}

function saveSessionRecord(scheduleId, date, patch) {
  const existing = sessionRecord(scheduleId, date);
  if (existing) return store.update('sessions', existing.id, patch);
  return store.insert('sessions', { id: uuid(), scheduleId, date, ...patch });
}

function appointmentsFor(scheduleId, date) {
  return store.getAll('appointments').filter(a => a.scheduleId === scheduleId && a.date === date);
}

function estimatedTime(schedule, queueNo, delayMinutes = 0) {
  return addMinutes(schedule.startTime, (queueNo - 1) * (schedule.slotMinutes || 10) + delayMinutes);
}

// Returns null when no bookable sitting can exist for this schedule on this date.
function buildSession(schedule, date) {
  if (!DATE_PATTERN.test(date || '')) return null;
  if (new Date(`${date}T00:00:00`).getDay() !== schedule.dayOfWeek) return null;
  const doctor = store.findById('doctors', schedule.doctorId);
  const center = store.findById('centers', schedule.centerId);
  if (!doctor || doctor.active === false || !center || center.active === false) return null;

  const record = sessionRecord(schedule.id, date) || {};
  const all = appointmentsFor(schedule.id, date);
  const active = all.filter(a => a.status !== 'cancelled');
  const capacity = capacityOf(schedule);
  const nextNo = all.reduce((max, a) => Math.max(max, a.queueNo), 0) + 1;
  const delayMinutes = record.delayMinutes || 0;

  const now = new Date();
  const today = toISODate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const ended = date < today || (date === today && nowMinutes >= toMinutes(schedule.endTime) + delayMinutes);

  let status = 'available';
  if (record.cancelled) status = 'cancelled';
  else if (ended || record.doctorStatus === 'finished') status = 'ended';
  else if (active.length >= capacity) status = 'full';

  const specialty = store.findById('specialties', doctor.specialtyId);
  const doctorFee = Number(doctor.consultationFee) || 0;
  const centerFee = Number(center.hospitalFee) || 0;
  const bookingFee = Number(center.bookingFee) || 0;

  return {
    scheduleId: schedule.id,
    date,
    doctorId: doctor.id,
    doctorName: doctor.name,
    specialtyId: doctor.specialtyId,
    specialtyName: specialty ? specialty.name : 'General',
    centerId: center.id,
    centerName: center.name,
    centerCity: center.city,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    capacity,
    booked: active.length,
    remaining: Math.max(capacity - active.length, 0),
    nextNo,
    estimatedTime: estimatedTime(schedule, nextNo, delayMinutes),
    status,
    doctorStatus: record.doctorStatus || 'scheduled',
    delayMinutes,
    nowServing: record.nowServing || 0,
    note: record.note || '',
    fees: { doctorFee, centerFee, bookingFee, total: doctorFee + centerFee + bookingFee }
  };
}

function listSessions({ doctorId, centerId, specialtyId, q, date, days = 14, includeEnded = false } = {}) {
  const needle = (q || '').trim().toLowerCase();
  const dates = [];
  if (date) {
    dates.push(date);
  } else {
    const cursor = new Date();
    for (let i = 0; i < days; i++) {
      dates.push(toISODate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const sessions = [];
  store.getAll('schedules')
    .filter(s => (!doctorId || s.doctorId === doctorId) && (!centerId || s.centerId === centerId))
    .forEach(schedule => {
      dates.forEach(d => {
        const session = buildSession(schedule, d);
        if (!session) return;
        if (session.status === 'ended' && !includeEnded) return;
        if (specialtyId && session.specialtyId !== specialtyId) return;
        if (needle && !session.doctorName.toLowerCase().includes(needle)) return;
        sessions.push(session);
      });
    });
  return sessions.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[\s-]/g, '');
}

function parsePatient(body) {
  const details = body || {};
  const name = String(details.name || '').trim();
  const phone = normalizePhone(details.phone);
  const nic = String(details.nic || '').trim().toUpperCase();
  if (!name) return { error: 'Patient name is required' };
  if (!/^\+?\d{9,12}$/.test(phone)) return { error: 'Enter a valid phone number' };
  if (nic && !/^(\d{9}[VX]|\d{12})$/.test(nic)) return { error: 'Enter a valid NIC number' };
  return { patient: { title: String(details.title || '').trim(), name, phone, nic } };
}

function newRefNo(date) {
  const taken = new Set(store.getAll('appointments').map(a => a.refNo));
  const prefix = `CH${date.slice(2).replace(/-/g, '')}`;
  let refNo;
  do {
    refNo = `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')}`;
  } while (taken.has(refNo));
  return refNo;
}

function createAppointment({ schedule, date, patient, patientId, source, paid, notes }) {
  const session = buildSession(schedule, date);
  if (!session) return { status: 404, error: 'This session is not available' };
  if (session.status === 'cancelled') return { status: 409, error: 'This session has been cancelled' };
  if (session.status === 'ended') return { status: 409, error: 'This session has already ended' };
  if (session.status === 'full') return { status: 409, error: 'This session is fully booked' };

  const { doctorFee, centerFee, bookingFee, total } = session.fees;
  const appt = {
    id: uuid(),
    refNo: newRefNo(date),
    patientId: patientId || null,
    patientDetails: patient,
    doctorId: schedule.doctorId,
    centerId: schedule.centerId,
    scheduleId: schedule.id,
    date,
    time: estimatedTime(schedule, session.nextNo),
    queueNo: session.nextNo,
    status: 'booked',       // booked | completed | cancelled | no-show
    paymentStatus: paid ? 'paid' : 'pending', // pending | paid | refund-due | refunded
    doctorFee,
    centerFee,
    bookingFee,
    amount: total,
    source: source || 'online', // online | counter
    notes: notes || '',
    createdAt: new Date().toISOString()
  };
  store.insert('appointments', appt);

  const message = `${session.doctorName} at ${session.centerName} on ${date}. Appointment No. ${appt.queueNo}, Ref ${appt.refNo}.`;
  notify(patientId, `Appointment booked: ${message}`);
  const doctor = store.findById('doctors', schedule.doctorId);
  notify(doctor.userId, `New appointment for ${patient.name} on ${date} (No. ${appt.queueNo}).`);
  return { appt };
}

module.exports = {
  DOCTOR_STATUSES,
  addMinutes,
  appointmentsFor,
  buildSession,
  capacityOf,
  createAppointment,
  estimatedTime,
  listSessions,
  normalizePhone,
  notify,
  parsePatient,
  saveSessionRecord,
  sessionRecord,
  toISODate
};
