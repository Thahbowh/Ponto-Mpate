# Ponto Mpate

**Funeral contribution management for community schemes.**

Ponto Mpate helps a community scheme in QwaQwa, South Africa, collect, record and account for funeral contributions. When a funeral event is created, every participating household owes a fixed contribution (R12 by default). Administrators record payments and issue receipts, members can see and pay what their household owes, and the scheme owner can reconcile the money collected with the money handed over.

This is a **hackathon prototype** built for the FNB App Academy Hackathon. It runs on **fictional demo data only**. No real money moves, and the online checkout, shop-voucher and USSD features are simulations (see [Limitations](#limitations-and-next-steps)).

## Contents

1. [Technologies](#technologies)
2. [Project structure](#project-structure)
3. [Getting started](#getting-started)
4. [Environment configuration](#environment-configuration)
5. [Database commands](#database-commands)
6. [Features](#features)
7. [API overview](#api-overview)
8. [Testing](#testing)
9. [Limitations and next steps](#limitations-and-next-steps)
10. [Before you deploy](#before-you-deploy)

## Technologies

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Start and Router (file-based routes), Tailwind CSS 4, lucide-react |
| Backend | Node.js, Express, TypeScript (run with `tsx`), Zod for validation |
| Database | MySQL, accessed through Prisma 6 (MySQL Workbench is handy for inspecting data) |
| Security | JWT sign-in, bcrypt password hashing, role-based access, rate limiting, HMAC-signed payment notifications |

## Project structure

```
ponto-mpate/
  backend/
    prisma/
      schema.prisma        Database schema
      migrations/          Migration history
      seed.ts              Original seed script
      reset-demo.ts        One-command demo reset (wipes and rebuilds fictional data)
    src/
      index.ts             Starts the server
      app.ts               Express app, middleware and route wiring
      lib/                 Prisma client, reconciliation, online payments, vouchers, rate limiters
      middleware/          authenticate, authorize, error handler
      routes/              One file per feature area
  frontend/
    src/
      routes/              Pages (landing, sign in, staff app, member portal, USSD simulator)
      features/            Auth context and member/payment components
      components/          Layout and shared UI (status badges, form fields, states)
      lib/                 API client, formatters, data-loading hook
      types/               Shared TypeScript types for API responses
```

## Getting started

### Prerequisites

- Node.js (a current LTS release)
- MySQL Server running locally, and MySQL Workbench (optional but useful)
- PowerShell or any terminal (the examples use PowerShell)

### 1. Create the database

In MySQL Workbench, run:

```sql
CREATE DATABASE ponto_mpate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ponto_user'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON *.* TO 'ponto_user'@'localhost';
FLUSH PRIVILEGES;
```

The broad grant is for **local development only**. Prisma Migrate needs permission to create a temporary shadow database. Do not use it on a hosted database.

### 2. Configure and start the backend

```powershell
cd backend
npm install
# create backend/.env (see "Environment configuration" below)
npx prisma migrate dev
npx prisma generate
npx tsx prisma/reset-demo.ts --yes     # builds the fictional demo data
npm run dev
```

The API runs on `http://localhost:4000`. Check it at `http://localhost:4000/api/v1/health`.

### 3. Configure and start the frontend

```powershell
cd frontend
npm install
Set-Content .env.local "VITE_API_URL=http://localhost:4000/api/v1"
npm run dev
```

Open the address printed in the terminal.

### Demo accounts

`reset-demo.ts` creates three accounts:

| Account | Role | What it is for |
|---|---|---|
| `admin@demo.example` | Administrator | Full access to the staff screens |
| `viewer@demo.example` | Viewer | Read-only access to the staff screens |
| `member@demo.example` | Member | Already approved for household `DEMO-W2-003`, which still owes R12 on the active event |

Passwords come from `DEMO_ADMIN_PASSWORD`, `DEMO_VIEWER_PASSWORD` and `DEMO_MEMBER_PASSWORD` in `backend/.env`, or from the defaults in `prisma/reset-demo.ts`. Set your own values before sharing a hosted demo, and share them with reviewers privately.

### The demo data

- 4 fictional wards in a chain (1 next to 2, 2 next to 3, 3 next to 4) and 18 fictional households with references like `DEMO-W1-001`.
- **FE-2026-001**: a closed historical event, about 90% collected, with its cash fully reconciled.
- **FE-2026-002**: an active event, about 45% collected, with cash recorded but no handover yet, ready for a live reconciliation.

Run `npx tsx prisma/reset-demo.ts --yes` at any time to return to this state.

## Environment configuration

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `mysql://USER:PASSWORD@localhost:3306/ponto_mpate`. URL-encode special characters in the password. |
| `JWT_SECRET` | Yes | A long random string (32 characters or more) used to sign sign-in tokens. |
| `JWT_EXPIRES_IN` | No | Token lifetime. Defaults to `8h`. |
| `PORT` | No | API port. Defaults to `4000`. |
| `PAYMENT_WEBHOOK_SECRET` | Yes for payments | At least 16 characters. Used to sign and verify payment and voucher notifications. |
| `PAYMENT_MODE` | No | `demo` enables the simulated checkout and USSD service. Outside development the default is disabled. |
| `DEMO_VOUCHER_FEE_PERCENT` | No | Simulated provider fee as a percentage of each voucher transaction. Defaults to `0.25`. |
| `DEMO_ADMIN_PASSWORD`, `DEMO_VIEWER_PASSWORD`, `DEMO_MEMBER_PASSWORD` | No | Passwords for the demo accounts created by `reset-demo.ts`. |
| `SEED_ADMIN_PASSWORD` | Only for `prisma db seed` | Admin password used by the original seed script. |
| `NODE_ENV` | No | Set to `production` when deployed. The demo reset refuses to run in production. |

Never commit `.env` files. Generate secrets with a cryptographic random generator, for example:

```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
($b | ForEach-Object { $_.ToString("x2") }) -join ""
```

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the API, for example `http://localhost:4000/api/v1`. Change it when the backend is hosted. |

## Database commands

Run these from the `backend` folder. **Stop the dev server first** when running `migrate dev` or `generate` on Windows, otherwise Prisma can fail with an `EPERM` error.

| Command | What it does |
|---|---|
| `npx prisma validate` | Checks the schema is valid |
| `npx prisma migrate dev --name <name>` | Creates and applies a migration locally |
| `npx prisma migrate status` | Shows which migrations are applied or pending |
| `npx prisma migrate deploy` | Applies pending migrations to a hosted database (no shadow database needed) |
| `npx prisma generate` | Regenerates the Prisma client after a schema change |
| `npx prisma studio` | Opens a browser view of the data |
| `npx tsx prisma/reset-demo.ts` | Dry run: shows which database it would reset and deletes nothing |
| `npx tsx prisma/reset-demo.ts --yes` | **Deletes all data** and rebuilds the demo |
| `npx prisma db seed` | Runs the original seed script |

`reset-demo.ts` is built for fictional data only. It does nothing without `--yes`, refuses to run when `NODE_ENV=production`, and aborts if it finds households whose references do not look like demo data.

### Main tables

| Table | Purpose |
|---|---|
| `User` | Administrators, viewers and members (`ADMIN`, `VIEWER`, `MEMBER`) |
| `Ward`, `WardNeighbour` | Wards and which wards neighbour each other |
| `Household` | Participating households |
| `HouseholdMember` | Links a member account to one household, with a pending, approved or declined status |
| `FuneralEvent`, `EventEligibleWard` | Events and the wards that take part (home ward plus neighbours) |
| `ContributionObligation` | What one household owes for one event. An obligation is not a payment. |
| `Payment`, `Receipt` | Money received (cash, transfer, online or shop voucher) and its unique receipt |
| `PaymentAttempt` | One online checkout attempt. A verified success creates exactly one payment. |
| `CashHandover` | Cash passed on to the scheme, compared with the cash payments recorded |
| `VoucherTransaction` | Shop-voucher payments with gross, fee, net and settlement status |
| `AuditLog` | Who did what, and when |
| `Setting` | One row holding the scheme name and default contribution amount |

Money is stored as `DECIMAL(10,2)`, never as floating point.

## Features

### Staff screens (administrators and viewers)

- **Dashboard**: expected, recorded and outstanding totals, progress per event, recent payments and items needing attention. Every figure is calculated by the server from saved records.
- **Funeral events**: create an event for a home ward. The server adds the neighbouring wards and creates one contribution for every active household in them, in one transaction.
- **Households and wards**: search and filter households, register households and create wards, with field-level validation and duplicate protection.
- **Join requests**: approve or decline members who ask to be linked to a household.
- **Record contribution**: pick an event and household, enter the amount and method, review, and confirm. Success is shown only after the server confirms the save. A receipt is issued and can be printed. Retrying the same payment cannot record it twice.
- **Reconciliation**: compare cash recorded with cash handed over. A difference is shown as "needs review" in neutral wording, never as an accusation. An event can only be closed once its cash matches, and a closed event accepts no more payments.
- **Insights**: explainable checks (low collection, wards with no payments, possible duplicate payments, cash that does not match) with a "how this was calculated" note for each. The forecast stays switched off until there are at least five closed events.
- **Shop vouchers**: confirmed voucher payments, simulated provider fees, net amounts, and a settlement report form that only marks payments as settled when the reported total matches.

### Member portal

- **Sign up and sign in**: self-registration always creates a member account.
- **Join a household**: choose a ward and enter a household reference. An administrator approves the request. Guessing references is rate-limited.
- **Home, Contributions and Payments**: what the household owes, what is paid, payment history and receipts, limited to the member's own household.
- **My ward**: aggregate counts only, shown as three separate numbers: registered households, active participating households and member accounts.
- **Demo online checkout**: a clearly labelled practice payment. The server verifies a signed notification before it records anything.
- **Pay cash at a shop (simulated)**: the member gets a 9-digit payment reference with a check digit, then uses the USSD simulator at `/ussd-demo`. The service uses the standard `CON`/`END` menu format, shows the amount and fee before confirming, and never asks for a voucher PIN. A payment that cannot be verified is not recorded.

### How the backend protects the money

- Roles are enforced on the server. Members cannot reach any staff endpoint, and every member endpoint is limited to the member's own approved household.
- Payments and handovers carry idempotency keys, so a double click or retry does not duplicate them.
- Payment, receipt, status change and audit entry are saved together in a database transaction, with the contribution row locked so two payments cannot overpay it.
- Payment and voucher notifications must carry a valid HMAC signature over the raw request body. Duplicate notifications are recognised and ignored.
- Payment records are never deleted through the application. Corrections will need a controlled reversal flow.
- Important actions are written to an audit log.

## API overview

All routes are under `/api/v1`. Successful responses look like `{ "success": true, "data": ... }`. Errors look like `{ "success": false, "error": { "message": "...", "details": [...] } }`.

| Area | Routes | Access |
|---|---|---|
| Health | `GET /health` | Public |
| Auth | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` | Public / signed in |
| Wards and households | `GET/POST /wards`, `GET/POST /households` | Staff (writes: administrator) |
| Events | `GET/POST /funeral-events`, `GET /funeral-events/:id/obligations`, `POST /funeral-events/:id/close` | Staff (writes: administrator) |
| Payments | `POST /funeral-events/:id/payments`, `GET /receipts/:reference` | Staff (writes: administrator) |
| Reporting | `GET /dashboard`, `GET /insights` | Staff |
| Reconciliation | `GET /reconciliation/:eventId`, `POST /reconciliation` | Staff (writes: administrator) |
| Membership | `GET /membership-requests`, `POST /membership-requests/:id/approve` or `/reject` | Staff (decisions: administrator) |
| Vouchers | `GET /vouchers`, `POST /vouchers/settlements` | Staff (settlement: administrator) |
| Member portal | `GET /member/me`, `/member/wards`, `/member/contributions`, `/member/payments`, `/member/receipts/:reference`; `POST /member/household/join`, `/member/checkout`, `/member/contributions/:id/shop-reference` | Members |
| Provider and USSD | `POST /webhooks/payments`, `POST /webhooks/vouchers` (signature required), `POST /ussd/session` (demo mode) | Provider / demo |

## Testing

There is no automated test suite yet (see limitations). The prototype was tested by running the full journeys by hand against the demo data. Before testing, reset to a known state:

```powershell
cd backend
npx tsx prisma/reset-demo.ts --yes
```

### A five-minute walkthrough

1. Sign in as the administrator and open the **Dashboard**. Expect R300,00 expected, R216,00 recorded and R84,00 outstanding.
2. Open **Record contribution**, pay an unpaid household in event 2 in cash, then view and print the receipt.
3. In a second window, sign in as the member. Pay R12,00 through the demo checkout and view the receipt. Back on the administrator dashboard, the totals move.
4. As the member, open **Contributions**, choose **Pay cash at a shop**, then complete the steps in the USSD simulator.
5. On **Reconciliation** for event 2, record a handover a few rand short and see the neutral "needs review" message. Record the remainder, see "Matched", then close the event.
6. Open **Insights** and read the "how this was calculated" notes. On **Shop vouchers**, record a settlement report with a wrong total, then the right one.

Run the reset again before repeating the walkthrough, because closing an event is permanent.

### Behaviours worth checking

| Check | Expected result |
|---|---|
| Submit the same payment twice | One payment, one receipt |
| Pay more than the amount outstanding | Rejected with a clear message |
| Call a staff endpoint with a member's token | `403`, no data returned |
| Call `/webhooks/payments` or `/webhooks/vouchers` with a bad signature | `401 Invalid signature` |
| Enter a mistyped USSD reference | Rejected by the check digit before any lookup |
| Settlement report with the wrong total | Refused, nothing marked as settled |
| Close an event while its cash does not match | Refused with the reason |
| Pay on a closed event | Refused |

### A quick API check

```powershell
$body = @{ email = "admin@demo.example"; password = "<your demo admin password>" } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/v1/auth/login -ContentType "application/json" -Body $body
$h = @{ Authorization = "Bearer $($login.data.token)" }
Invoke-RestMethod -Uri http://localhost:4000/api/v1/dashboard -Headers $h
```

## Limitations and next steps

**Prototype status**
- Everything runs on fictional data. It is not ready to handle real money or real households without a security and POPIA review.
- There is no automated test suite. Tests for the payment, reconciliation and settlement rules are the most valuable next addition.

**Simulated integrations**
- The online checkout, shop-voucher payments and USSD service are simulations. In demo mode the server plays the payment provider by signing a notification and verifying it through the same code a real provider's notification would use. Real voucher redemption, a registered USSD code, merchant participation and bank settlement need a provider agreement and integration.
- The simulated provider fee of 0.25% per transaction is an assumption supplied by the team. Confirm the real fee structure (percentage, any minimum or flat part, and who bears it) in the provider's written terms. The 24-hour settlement figure is a target that depends on that agreement.
- Shop accounts are not implemented. The prototype assumes the shop sells the voucher and the member redeems it by USSD.

**Features not built yet**
- Reversals and corrections for payments and handovers. Records cannot be edited or deleted through the app, so mistakes currently need a direct database fix.
- A "resolved" workflow for reconciliation differences. A note on each handover is the only place to explain a difference.
- User management screens, password reset, and email or phone verification. Phone OTP and Google sign-in are shown on the sign-in page but are not available.
- A household detail page with its payment history for staff, and the ability to deactivate households, wards or events.
- A household registered after an event was created does not owe a contribution for that event.
- The forecast uses a simple average and only appears with five or more closed events. It is not a prediction model.

**Technical notes**
- Prisma 6 shows a deprecation warning about configuring Prisma in `package.json`. Moving to a `prisma.config.ts` file is a later upgrade.
- Rate limiting is held in memory, so it applies per server instance.
- Backups, monitoring and a hosted environment are not configured in this repository.

## Before you deploy

- Use a hosted MySQL database and apply the schema with `npx prisma migrate deploy`.
- Set `NODE_ENV=production`, a new long `JWT_SECRET`, a new `PAYMENT_WEBHOOK_SECRET`, and keep `.env` files out of version control.
- Restrict CORS to the frontend's URL (currently it allows any origin for local development).
- Serve everything over HTTPS and set `VITE_API_URL` to the hosted API.
- Choose new demo passwords. Only run `reset-demo.ts` against a database that holds nothing but demo data.
- Keep `PAYMENT_MODE=demo` only on demo environments. Do not enable it where real payments could be confused with simulated ones.

## Data protection

The prototype collects the minimum personal information needed to work: a member's name and email address. It does not store phone numbers, voucher PINs or card details, and funeral event labels are meant to be neutral, with no personal details about the person who has died. A real deployment should be reviewed against POPIA before any real data is used.

## Licence

To be decided by the team.