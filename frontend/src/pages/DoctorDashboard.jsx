import { useEffect, useState } from 'react';
import api from '../api';
import { localISODate } from '../utils/format';

function PrescriptionForm({ appointment, onDone }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', duration: '' }]);
  const [busy, setBusy] = useState(false);

  function updateMed(i, field, value) {
    const next = [...medicines];
    next[i][field] = value;
    setMedicines(next);
  }

  function addMed() {
    setMedicines([...medicines, { name: '', dosage: '', duration: '' }]);
  }

  async function submit() {
    setBusy(true);
    try {
      await api.post('/prescriptions', {
        appointmentId: appointment.id,
        diagnosis,
        advice,
        medicines: medicines.filter(m => m.name)
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="prescription-form">
      <input placeholder="Diagnosis" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
      {medicines.map((m, i) => (
        <div className="med-row" key={i}>
          <input placeholder="Medicine" value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} />
          <input placeholder="Dosage" value={m.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} />
          <input placeholder="Duration" value={m.duration} onChange={e => updateMed(i, 'duration', e.target.value)} />
        </div>
      ))}
      <button type="button" className="link-btn" onClick={addMed}>+ Add medicine</button>
      <textarea placeholder="Advice for patient" value={advice} onChange={e => setAdvice(e.target.value)} />
      <button className="primary-btn" disabled={busy} onClick={submit}>Save Prescription & Complete Visit</button>
    </div>
  );
}

export default function DoctorDashboard() {
  const [date, setDate] = useState(localISODate());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rxFor, setRxFor] = useState(null);

  function refresh() {
    setLoading(true);
    api.get('/appointments/doctor', { params: { date } })
      .then(res => setAppointments(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, [date]);

  async function noShow(id) {
    await api.patch(`/appointments/${id}/no-show`);
    refresh();
  }

  return (
    <div className="dashboard">
      <h1>Doctor Dashboard</h1>
      <label className="date-picker">
        Date
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </label>

      {loading ? (
        <div className="page-loading">Loading queue...</div>
      ) : appointments.length === 0 ? (
        <p>No appointments on this date.</p>
      ) : (
        <div className="appointment-list">
          {appointments.map(a => (
            <div key={a.id} className={`appointment-card status-${a.status}`}>
              <div>
                <h3>No. {a.queueNo} &middot; {a.patientName}</h3>
                <p>{a.date} &middot; {a.scheduleTime} &middot; {a.location}</p>
                {a.patientPhone && <p className="meta">{a.patientPhone}</p>}
                <p>Status: <strong>{a.status}</strong> &middot; Payment: <strong>{a.paymentStatus}</strong></p>
                {a.notes && <p className="meta">Notes: {a.notes}</p>}
              </div>
              {a.status === 'booked' && (
                <div className="appointment-actions">
                  <button className="secondary-btn" onClick={() => setRxFor(rxFor === a.id ? null : a.id)}>
                    {rxFor === a.id ? 'Close' : 'Add Prescription / Complete'}
                  </button>
                  <button className="danger-btn" onClick={() => noShow(a.id)}>Mark No-show</button>
                </div>
              )}
              {rxFor === a.id && (
                <PrescriptionForm appointment={a} onDone={() => { setRxFor(null); refresh(); }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
