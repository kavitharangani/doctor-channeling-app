import { formatDate, formatTime, money } from '../utils/format';

const STATUS_TEXT = {
  available: 'Available',
  full: 'Fully booked',
  cancelled: 'Cancelled',
  ended: 'Ended'
};

export default function SessionCard({ session, showDoctor, actionLabel, onAction, selected }) {
  const bookable = session.status === 'available';
  return (
    <article className={`session-card${selected ? ' selected' : ''}${bookable ? '' : ' closed'}`}>
      <div className="session-main">
        {showDoctor && <h3>{session.doctorName}</h3>}
        <p className="session-date">{formatDate(session.date)}</p>
        <p className="meta">{formatTime(session.startTime)} to {formatTime(session.endTime)}</p>
        <p className="meta">{session.centerName}{session.centerCity ? `, ${session.centerCity}` : ''}</p>
        {session.doctorStatus === 'delayed' && (
          <p className="session-warning">
            Delayed{session.delayMinutes ? ` by about ${session.delayMinutes} minutes` : ''}
          </p>
        )}
        {session.status === 'cancelled' && session.note && <p className="session-warning">{session.note}</p>}
      </div>
      <div className="session-side">
        <span className={`session-status ${session.status}`}>{STATUS_TEXT[session.status]}</span>
        {bookable && (
          <>
            <p className="session-next">Next No. <strong>{session.nextNo}</strong></p>
            <p className="meta">{session.remaining} left &middot; about {formatTime(session.estimatedTime)}</p>
          </>
        )}
        <p className="session-fee">{money(session.fees.total)}</p>
        {bookable && onAction && (
          <button type="button" className="primary-btn session-btn" onClick={() => onAction(session)}>
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}
