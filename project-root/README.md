# Virtual Wallet & Food Coupon System

A closed-loop virtual currency system for college club events. Heads issue virtual money,
students spend it with vendors, vendors get paid back in real money afterward — outside the app.

## Architecture

- **Backend:** Node.js + Express + MongoDB (Mongoose) + Socket.IO
- **Frontend:** React (Vite) — one app, two role-based areas (`/head/*` and `/app/*` for students+vendors)
- **Auth:** Email OTP signup (whitelist-gated) + JWT in httpOnly cookie
- **Money model:** Balance lives directly on the User document; every movement is recorded
  immutably in the Transaction collection, which acts as the ledger of truth.
- **Real-time:** Vendors join a private Socket.IO room on connect; successful payments emit
  a `payment_received` event instantly. The database remains the source of truth — sockets
  are notification-only, and the frontend re-fetches balance on reconnect.

## Features

- Head: top-up (creates money), single/bulk distribute, dashboard stats, search, transaction filters
- Student: OTP signup, send money (roll number or QR), scan QR, view balance/history
- Vendor: OTP signup, view balance/history, real-time payment popups, QR code to receive
- Server-side atomic transfers (MongoDB sessions) — no double-spending, no partial transactions
- Accounting invariant check (`/api/head/verify-invariant`) to catch inconsistencies

## Tech Stack

React, Vite, React Router, Axios, Socket.IO client, qrcode.react, html5-qrcode —
Node.js, Express, Mongoose, JWT, bcryptjs, Socket.IO, Nodemailer, Zod, express-rate-limit,
Helmet — MongoDB Atlas — Render (backend) + Vercel (frontend)

## Project Structure

```
project-root/
  client/
    src/
      components/       ProtectedRoute
      context/           AuthContext, SocketContext
      pages/
        head/             HeadDashboard
        shared/            Dashboard, SendMoneyModal, ScanQRModal (Student + Vendor)
        Login.jsx, Signup.jsx
      services/           api.js (axios instance)
      App.jsx, main.jsx
    package.json, vite.config.js, index.html, .env

  server/
    src/
      config/            db.js
      models/            User.js, Transaction.js
      middleware/         auth.js
      routes/             auth.js, wallet.js, head.js
      services/           walletService.js (atomic transfer engine)
      sockets/            index.js
      utils/              email.js, jwt.js
      tests/              wallet.test.js
    scripts/              seedUsers.js
    server.js, package.json, .env.example, jest.config.js

  .gitignore
  README.md
```

## Local Setup

### Backend
```
cd server
npm install
cp .env.example .env   # fill in your values
npm run seed            # preload authorized students/vendors/heads
npm run dev
```

### Frontend
```
cd client
npm install
npm run dev
```

## Environment Variables

See `server/.env.example` for the full list: `MONGODB_URI`, `TEST_MONGODB_URI`, `JWT_SECRET`,
`JWT_EXPIRES_IN`, `CLIENT_URL`, `EMAIL_HOST/PORT/USER/PASSWORD/FROM`, `SERVER_PORT`.
Frontend needs `VITE_API_URL` in `client/.env`.

## MongoDB Setup

1. Create a free Atlas M0 cluster (M0 includes a replica set, required for transactions).
2. Create a database user and allow network access.
3. Copy the connection string into `MONGODB_URI`.
4. Edit `server/scripts/seedUsers.js` with your real students/vendors/heads, then `npm run seed`.

## Running Tests

```
cd server
npm run test
```
Point `TEST_MONGODB_URI` at a separate database — the suite creates/deletes throwaway
`@wallettest.local` users on every run.

## Deployment

- **Database:** MongoDB Atlas (free tier)
- **Backend:** Render — root dir `server`, build `npm install`, start `npm start`
- **Frontend:** Vercel — root dir `client`, framework Vite, env `VITE_API_URL`
- Update `CLIENT_URL` on Render to match your live Vercel URL for CORS to work.
- Render free tier sleeps after inactivity — warm it up before a live event by hitting `/api/health`.

## API Overview

- `POST /api/auth/signup/request-otp|verify-otp|set-password`, `login`, `logout`, `GET /me`
- `GET /api/wallet`, `POST /api/wallet/transfer`, `GET /api/wallet/transactions`, `GET /api/wallet/lookup/:walletId`
- `POST /api/head/topup|distribute|bulk-distribute`, `GET /api/head/dashboard|transactions|students|vendors|search|verify-invariant`

## Security Notes

- Passwords hashed with bcrypt; OTPs hashed, expire in 10 minutes, capped at 5 attempts.
- JWT stored in httpOnly cookie — not accessible to JS, mitigating XSS token theft.
- Every transfer is validated and executed server-side inside a MongoDB session/transaction —
  frontend-supplied balances, roles, and amounts are never trusted.
- Only the Head role can create new money (`topUpHead`); students/vendors can only move funds
  they already hold.
- QR codes encode only a public `walletId` — no passwords, tokens, or private data.
- This is **not** a real payment system — no UPI/bank/card integration. Vendor cash-out happens
  manually outside the app.
