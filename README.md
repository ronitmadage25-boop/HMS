# Hostel Management System (MERN)

Built from the SRS v1.0: MongoDB, Express, React (Vite), Node.js, Tailwind CSS.
Roles: Student, Warden, Hostel Staff, Administrator.

## Run it (step by step)

1. Install Node.js LTS (v18 or newer).
2. Open `server/.env` and paste your MongoDB link in `MONGODB_URI`.
   Also change `JWT_SECRET`, the admin password and the three invite codes.
3. In this folder run:
   ```
   npm install
   npm run setup
   npm run dev
   ```
4. Open http://localhost:5173
5. Sign in as **Administrator** with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`
   (the account is created automatically on first start).

Production: `npm start` builds the client and the API serves it on http://localhost:5000.

## First-time setup inside the app (as Administrator)

1. **Settings**: institution name, session, application deadline, visiting hours, late fee.
2. **Rooms, Add a block**: creates rooms in bulk (e.g. Block A, 4 floors, 10 rooms, "Double", 2 beds).
3. **Fees, New fee structure**: one per room type (session start date must be in the future).
4. **Users**: wardens and staff can register themselves with the invite codes, or you can create them.

Flow after that: Student applies, Warden approves, Warden allocates (manual or auto), invoice is generated,
Student pays, receipt is issued, Staff checks the student in.

## Notes

- **Nothing is pre-filled.** The only record created automatically is the first admin account.
- **Payments**: `PAYMENT_MODE=test` uses a built-in sandbox gateway (no real money).
  For real payments set `PAYMENT_MODE=razorpay` and add `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
- **E-mail**: fill the `SMTP_*` values for notification, receipt and password-reset e-mails and scheduled reports.
  Without SMTP, in-app notifications still work and the password-reset link is printed in the server console.
- **Anonymous complaints**: identity is hidden from wardens and staff; only the administrator can see it.
- Background jobs (every minute): no-show release after 7 days, overstay alerts, overdue complaints,
  auto-close after 5 days, fee reminders (7 days and 1 day), late fee, notification archival, scheduled reports.
- Uploaded files are stored in `server/uploads` and served by unguessable file names.

## Folder structure

```
server/   Express API (models, routes, jobs, utils)
client/   React + Tailwind app (pages, components)
```
