export function localISODate(d = new Date()) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
}

export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function money(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString('en-LK')}`;
}

export const DOCTOR_STATUS_LABELS = {
  scheduled: 'Not arrived yet',
  arrived: 'Doctor arrived',
  delayed: 'Delayed',
  finished: 'Session finished'
};
