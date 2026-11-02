import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime, money } from '../utils/format';

const PAYMENT_LABELS = {
  pending: 'Pay at the centre',
  paid: 'Paid',
  'refund-due': 'Refund due',
  refunded: 'Refunded'
};

export default function AppointmentReceipt() {
  const { id } = useParams();
  const { user } = useAuth();
  const [appt, setAppt] = useState(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/appointments/${id}`).then(res => setAppt(res.data)).catch(() => setFailed(true));
  }, [id]);

  async function pay() {
    setError('');
    try {
      const res = await api.patch(`/appointments/${id}/pay`);
      setAppt(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed');
    }
  }

  if (failed) return <p>Appointment not found.</p>;
  if (!appt) return <div className="page-loading">Loading...</div>;

  const cancelled = appt.status === 'cancelled';

  return (
    <div className="receipt">
      <header className="receipt-head">
        <div>
          <h1>{cancelled ? 'Appointment cancelled' : 'Appointment confirmed'}</h1>
          <p className="meta">Reference <strong className="ref-no">{appt.refNo}</strong></p>
        </div>
        <div className={`receipt-number${cancelled ? ' cancelled' : ''}`}>
          <span>Appointment No.</span>
          <strong>{appt.queueNo}</strong>
        </div>
      </header>

      <dl className="receipt-grid">
        <div><dt>Doctor</dt><dd>{appt.doctorName}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(appt.date)}</dd></div>
        <div>
          <dt>Estimated time</dt>
          <dd>{formatTime(appt.estimatedTime)}</dd>
        </div>
        <div>
          <dt>Centre</dt>
          <dd>
            {appt.location}
            {appt.centerAddress && <span className="meta receipt-sub">{appt.centerAddress}</span>}
            {appt.centerPhone && <span className="meta receipt-sub">{appt.centerPhone}</span>}
          </dd>
        </div>
        <div>
          <dt>Patient</dt>
          <dd>
            {appt.patientDetails?.title} {appt.patientName}
            <span className="meta receipt-sub">{appt.patientPhone}</span>
          </dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>{PAYMENT_LABELS[appt.paymentStatus] || appt.paymentStatus}</dd>
        </div>
      </dl>

      <dl className="fee-table">
        <div><dt>Doctor's fee</dt><dd>{money(appt.doctorFee ?? appt.amount)}</dd></div>
        <div><dt>Centre fee</dt><dd>{money(appt.centerFee)}</dd></div>
        <div><dt>Booking fee</dt><dd>{money(appt.bookingFee)}</dd></div>
        <div className="total"><dt>Total</dt><dd>{money(appt.amount)}</dd></div>
      </dl>

      {!cancelled && <p className="meta receipt-note">Please arrive 15 minutes early and bring this reference number. The time is an estimate and can change.</p>}
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="receipt-actions no-print">
        {!cancelled && appt.paymentStatus === 'pending' && user?.role === 'patient' && (
          <button className="primary-btn" onClick={pay}>Pay now (demo)</button>
        )}
        <button className="secondary-btn" onClick={() => window.print()}>Print receipt</button>
        <Link className="secondary-btn" to="/live">Live queue</Link>
        {user?.role === 'patient' && <Link className="secondary-btn" to="/dashboard">My appointments</Link>}
      </div>
    </div>
  );
}
