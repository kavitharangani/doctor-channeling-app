// Lightweight JSON-file database. No native modules required, so it installs
// cleanly on any machine (Windows/Mac/Linux) without build tools.
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  users: [],       // { id, role: 'patient'|'doctor'|'admin', name, email, passwordHash, phone, doctorId? }
  doctors: [],      // { id, userId, name, specialtyId, qualifications, experienceYears, consultationFee, bio, photo, active }
  specialties: [],  // { id, name }
  centers: [],      // { id, name, city, address, phone, hospitalFee, bookingFee, active }
  schedules: [],     // { id, doctorId, centerId, dayOfWeek(0-6), startTime, endTime, slotMinutes, location }
  sessions: [],      // { id, scheduleId, date, cancelled, doctorStatus, delayMinutes, nowServing, note }
  appointments: [],  // { id, refNo, patientId, patientDetails, doctorId, centerId, scheduleId, date, time, queueNo, status, paymentStatus, doctorFee, centerFee, bookingFee, amount, source, notes, createdAt }
  prescriptions: [], // { id, appointmentId, doctorId, patientId, diagnosis, medicines, advice, createdAt }
  reviews: [],       // { id, doctorId, patientId, appointmentId, rating, comment, createdAt }
  notifications: []  // { id, userId, message, read, createdAt }
};

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return migrate(JSON.parse(raw));
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Older data files have no centres, only a free-text location on each schedule.
function migrate(data) {
  const merged = { ...JSON.parse(JSON.stringify(DEFAULT_DATA)), ...data };
  let changed = Object.keys(merged).length !== Object.keys(data).length;
  merged.schedules.forEach(schedule => {
    if (schedule.centerId) return;
    const name = schedule.location || 'Main Clinic';
    let center = merged.centers.find(c => c.name === name);
    if (!center) {
      center = { id: uuid(), name, city: '', address: '', phone: '', hospitalFee: 0, bookingFee: 0, active: true };
      merged.centers.push(center);
    }
    schedule.centerId = center.id;
    changed = true;
  });
  if (changed) save(merged);
  return merged;
}

// simple in-memory cache, flushed to disk on every write for durability
let cache = load();

function getAll(table) {
  return cache[table];
}

function setAll(table, records) {
  cache[table] = records;
  save(cache);
}

function insert(table, record) {
  cache[table].push(record);
  save(cache);
  return record;
}

function update(table, id, patch) {
  const idx = cache[table].findIndex(r => r.id === id);
  if (idx === -1) return null;
  cache[table][idx] = { ...cache[table][idx], ...patch };
  save(cache);
  return cache[table][idx];
}

function remove(table, id) {
  const before = cache[table].length;
  cache[table] = cache[table].filter(r => r.id !== id);
  save(cache);
  return cache[table].length < before;
}

function findById(table, id) {
  return cache[table].find(r => r.id === id) || null;
}

function reload() {
  cache = load();
}

module.exports = { getAll, setAll, insert, update, remove, findById, reload, DATA_FILE };
