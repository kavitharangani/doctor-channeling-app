// Seeds the JSON "database" with an admin account, specialties, sample
// doctors (with login accounts + weekly schedules), and a demo patient.
// Run with: node seed.js
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const store = require('./db/store');

// Reset to a clean slate every time this script runs.
fs.writeFileSync(store.DATA_FILE, JSON.stringify({
  users: [], doctors: [], specialties: [], centers: [], schedules: [], sessions: [],
  appointments: [], prescriptions: [], reviews: [], notifications: []
}, null, 2));
store.reload();

function makeUser(role, name, email, password, extra = {}) {
  const user = {
    id: uuid(), role, name, email, phone: extra.phone || '',
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
    ...extra
  };
  store.insert('users', user);
  return user;
}

// --- Admin ---
makeUser('admin', 'System Admin', 'admin@channel.app', 'admin123');

// --- Specialties ---
const specialtyNames = ['Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'General Physician', 'ENT'];
const specialties = specialtyNames.map(name => {
  const sp = { id: uuid(), name };
  store.insert('specialties', sp);
  return sp;
});
const byName = n => specialties.find(s => s.name === n);

// --- Channeling centres (fictional) ---
const centers = [
  { name: 'City Care Medical Centre', city: 'Colombo', address: '45 Galle Road, Colombo 03', phone: '011 200 0100', hospitalFee: 600, bookingFee: 250 },
  { name: 'Hillview Hospital', city: 'Kandy', address: '12 Peradeniya Road, Kandy', phone: '081 200 0200', hospitalFee: 450, bookingFee: 200 },
  { name: 'Seaside Channeling Centre', city: 'Galle', address: '8 Wakwella Road, Galle', phone: '091 200 0300', hospitalFee: 400, bookingFee: 200 }
].map(c => store.insert('centers', { id: uuid(), ...c, active: true }));

// --- Doctors ---
const doctorDefs = [
  { name: 'Dr. Nimal Perera', email: 'nimal.perera@channel.app', specialty: 'Cardiology', qualifications: 'MBBS, MD (Cardiology)', experienceYears: 15, fee: 2500, bio: 'Consultant Cardiologist with 15 years of experience in interventional cardiology.' },
  { name: 'Dr. Kavindi Silva', email: 'kavindi.silva@channel.app', specialty: 'Dermatology', qualifications: 'MBBS, Dip. Dermatology', experienceYears: 8, fee: 2000, bio: 'Specialist in skin, hair, and cosmetic dermatology.' },
  { name: 'Dr. Ruwan Fernando', email: 'ruwan.fernando@channel.app', specialty: 'Pediatrics', qualifications: 'MBBS, MD (Paediatrics)', experienceYears: 12, fee: 1800, bio: 'Consultant Paediatrician focused on child growth and immunization.' },
  { name: 'Dr. Sanduni Jayasuriya', email: 'sanduni.j@channel.app', specialty: 'Orthopedics', qualifications: 'MBBS, MS (Ortho)', experienceYears: 10, fee: 2200, bio: 'Orthopedic surgeon specializing in sports injuries and joint replacement.' },
  { name: 'Dr. Chamara Bandara', email: 'chamara.bandara@channel.app', specialty: 'General Physician', qualifications: 'MBBS', experienceYears: 6, fee: 1200, bio: 'General physician providing primary care for all ages.' },
  { name: 'Dr. Ishara Gunasekara', email: 'ishara.g@channel.app', specialty: 'ENT', qualifications: 'MBBS, MS (ENT)', experienceYears: 9, fee: 2100, bio: 'Ear, Nose and Throat specialist.' }
];

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const doctors = doctorDefs.map((def, index) => {
  const doctorId = uuid();
  const user = makeUser('doctor', def.name, def.email, 'doctor123', { doctorId });
  const doctor = {
    id: doctorId,
    userId: user.id,
    name: def.name,
    specialtyId: byName(def.specialty).id,
    qualifications: def.qualifications,
    experienceYears: def.experienceYears,
    consultationFee: def.fee,
    bio: def.bio,
    photo: '',
    active: true
  };
  store.insert('doctors', doctor);

  // Weekday evenings at one centre, Saturday mornings at another.
  const home = centers[index % centers.length];
  const visiting = centers[(index + 1) % centers.length];
  const weekday = (index % 5) + 1;
  const pattern = [
    { center: home, dayOfWeek: weekday, startTime: '18:00', endTime: '20:00' },
    { center: home, dayOfWeek: ((weekday + 2) % 5) + 1, startTime: '17:00', endTime: '19:00' },
    { center: visiting, dayOfWeek: 6, startTime: '09:00', endTime: '11:00' }
  ];
  pattern.forEach(p => {
    store.insert('schedules', {
      id: uuid(), doctorId, centerId: p.center.id, dayOfWeek: p.dayOfWeek, startTime: p.startTime, endTime: p.endTime,
      slotMinutes: 10, location: p.center.name
    });
  });

  return doctor;
});

// --- Demo patient ---
makeUser('patient', 'Sample Patient', 'patient@channel.app', 'patient123');

console.log('Seed complete.');
console.log('Login accounts:');
console.log('  Admin:   admin@channel.app / admin123');
console.log('  Patient: patient@channel.app / patient123');
doctorDefs.forEach(d => console.log(`  Doctor:  ${d.email} / doctor123  (${d.name})`));
console.log(`Data file: ${store.DATA_FILE}`);
