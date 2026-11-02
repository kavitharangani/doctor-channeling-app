# Doctor Channeling App

A full-featured doctor appointment booking ("channeling") web app with three roles: **Patient**, **Doctor**, and **Admin**.

## What's included

- **Patient**: register/login, search doctors by name/specialty, view doctor profiles & reviews, check live slot availability, book an appointment (gets a queue number), mock online payment, cancel appointments, view appointment history, view prescriptions, leave a rating/review after a completed visit, in-app notifications.
- **Doctor**: login, view today's (or any date's) patient queue in order, mark a visit complete while writing a prescription (diagnosis, medicines, advice), mark a patient as no-show.
- **Admin**: dashboard with stats (total doctors/patients/appointments/revenue, appointments by status, top doctors), manage specialties, add, edit, search, deactivate and reactivate doctors (creates their login, and can change their login email or password), configure each doctor's weekly clinic schedule, view all appointments across the system.

- **Channeling centres**: several centres with their own fees, session-based booking with a running appointment number, doctor + centre + booking fee breakdown, patient details on each booking (so you can book for family), a printable receipt with a reference number, a public Live Queue page with "Check my appointment" (reference + mobile number), and an admin Front Desk (call next number, doctor arrived/delayed, cancel a session with patient notifications and refund tracking, counter bookings for walk-ins).

## Tech stack

- **Backend**: Node.js + Express, JWT authentication, bcrypt password hashing. Data is stored in a simple JSON file (`backend/db/data.json`) — no database server or native modules to install, so it runs anywhere Node runs.
- **Frontend**: React (Vite) + React Router + Axios.

## Project structure

```
doctor-channeling-app/
  backend/     Express API (port 4000)
    routes/    auth, doctors, centers, sessions, appointments, prescriptions, reviews, notifications, admin
    lib/       session, queue and booking logic
    db/        JSON file store + data.json
    seed.js    resets data and creates sample doctors/admin/patient
  frontend/    React app (port 5173 in dev)
    src/pages, src/components, src/context
```

## Running it (Windows / Mac / Linux)

You need [Node.js](https://nodejs.org) 18+ installed. Open two terminals.

**Terminal 1 — backend**
```
cd backend
npm install
node seed.js        # creates sample doctors, admin, and a demo patient (safe to re-run any time to reset data)
npm start
```
The API runs at `http://localhost:4000`.

**Terminal 2 — frontend**
```
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (usually `http://localhost:5173`).

## Demo logins (created by `node seed.js`)

| Role    | Email                          | Password  |
|---------|---------------------------------|-----------|
| Admin   | admin@channel.app               | admin123  |
| Doctor  | nimal.perera@channel.app        | doctor123 |
| Patient | patient@channel.app      | patient123|

(Five more sample doctors are seeded too — see `backend/seed.js` for the full list, all use password `doctor123`.)

## Deployment

`render.yaml` deploys the whole app as one [Render](https://render.com) web service: the backend serves the built frontend and the API from the same URL. The free plan has no permanent disk, so the live demo goes back to fresh sample data each time it restarts, and it can take up to a minute to wake after being idle.

The demo logins above are public, so don't enter real patient details on the live demo.

## Notes on scope

- **Payments** are a mock "Pay Now" button (marks the appointment as paid) rather than a real payment gateway — wiring up Stripe/PayHere would need real merchant API keys.
- **Notifications** are in-app only (shown in the patient's dashboard) rather than real SMS/email, which would need a paid SMS/email provider.
- Resetting data: run `node seed.js` again in the backend folder — it wipes and recreates sample data.
