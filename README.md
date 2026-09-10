# ☀️ Gold Mitra — Field Gold-Loan Suite

A premium, mobile-first web application for managing gold-loan field work.
Clean and modern UI, simple functionality, built to be deployed on Vercel.

## Tech Stack

- **HTML / CSS / Vanilla JavaScript** — no frameworks, no build step
- **Node.js + Express** — API and page serving
- **MongoDB Atlas** — persistence via Mongoose
- **Vercel-ready** — simple wrapperless Node serverless deploy

## Project Structure

```
gold-mithra/
├── server.js               # Express entry (handles both local + Vercel)
├── package.json
├── vercel.json             # Vercel serverless config
├── .env                    # Local secrets (git-ignored)
├── .env.example            # Template for environment variables
├── src/
│   ├── config/
│   │   └── db.js           # MongoDB connection lifecycle
│   ├── middleware/
│   │   └── auth.js         # Session guards (requireAuth, requireAdmin)
│   ├── models/
│   │   ├── Staff.js        # Staff schema + password hashing
│   │   └── Application.js  # Loan application: customer, jewellery items, loan
│   └── routes/
│       ├── auth.js         # /api/auth/* login, logout, me
│       ├── dashboard.js    # /api/dashboard/stats, /api/health
│       ├── applications.js # /api/applications* create, list, get, update, delete
│       └── staff.js        # /api/staff* list, create, activate/deactivate (admin only)
├── public/
│   ├── css/               # Design system + records.css + print.css + settings.css
│   └── js/                # UI kit, nav, auth, dashboard, application, records, print, settings
├── test/
│   ├── e2e-application.js  # API-level create/read/update/delete test (needs server + Mongo)
│   └── workflow-test.js    # Full journey + security test (pages, staff, CSRF, rate-limit, headers)
└── views/
    ├── login.html          # Login page
    ├── dashboard.html      # Main dashboard (sidebar + topbar + mobile nav)
    ├── application.html    # New Application field form (customer/jewellery/loan)
    ├── records.html        # Records list (search + cards/table)
    ├── record.html         # Record detail (edit/delete)
    ├── record-print.html   # Dedicated A4 print document (hard copy)
    └── settings.html       # Admin team management (field employees)
```

## Getting Started

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI
npm run dev               # auto-restart on changes
# or
npm start
```

Open <http://localhost:3000> — you'll be redirected to `/login`.

### Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string (database `gold-mithra`) |
| `SESSION_SECRET` | Yes (prod) | Secret signing session cookies — **≥24 random chars**; the app refuses to start in production without it |
| `SESSION_MAX_AGE_MS` | No | Session lifetime in milliseconds (default `86400000` = 1 day) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | For bootstrap | First-run admin, created only when the staff collection is empty. In production the default password is **never** used — set a strong one |
| `ADMIN_NAME` | No | Bootstrap admin display name |
| `PORT` | No | Local port (default `3000`) |
| `NODE_ENV` | No | `development` or `production`. Production enables Secure cookies + fail-fast secret check |

Generate a secret locally with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> If `MONGODB_URI` is not set the app still runs — pages render, stats and login
> report "database unavailable" instead of failing hard.

### MongoDB Atlas setup

1. Create a free **MongoDB Atlas** cluster (cloud.mongodb.com).
2. **Database Access** → *Add New Database User* → choose **Password** authentication.
3. **Network Access** → *Add IP Address* → `0.0.0.0/0` (allow from anywhere; Vercel functions have dynamic egress IPs) or your office's static IP for tighter security.
4. **Database** → *Browse Collections* → *Create Database* named **gold-mithra**.
5. **Database** → *Connect* → *Drivers* → copy the `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/…` URI and put it in `MONGODB_URI`. Collection names are created automatically on first save.

## Deploying to Vercel

1. Push the project to a GitHub/GitLab/Bitbucket repo.
2. In Vercel: **Add New → Project** → import the repo.
3. Vercel detects `vercel.json` automatically (no framework preset needed — it deploys
   `server.js` as a Node serverless function and routes every request to it).
4. Add environment variables under **Project → Settings → Environment Variables**:
   `MONGODB_URI`, `SESSION_SECRET`, `NODE_ENV=production`, and (for a fresh database)
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
5. **Deploy**. The first API call on a cold instance lazily connects to Atlas and
   bootstraps the admin if the staff collection is empty, so no separate server process
   is required.

### Custom domain

1. In **Vercel → Project → Settings → Domains**, add your domain (e.g. `goldmitra.in`).
2. Vercel shows the target DNS records — add an `A`/`ALIAS` record (or `CNAME` for a
   subdomain like `app.goldmitra.in`) at your DNS provider.
3. Wait for propagation (usually minutes); TLS is issued automatically.
4. Update the app: set `SESSION_SECRET` to a new value, keep `NODE_ENV=production`.
   No hostname is hard-coded — the app uses relative URLs only, so it works on any domain.

> Note: sessions are in-memory by default, which is fine for a single serverless instance
> but resets across instances and cold starts. For multi-instance scale, swap to a shared
> session store (`connect-mongo`) — see *Remaining issues*.

## Design System

The reusable styles live under `public/css/`:

- `variables.css` — colors, fonts, spacing, radii, shadows, motion tokens
- `base.css` — reset, typography, utilities, keyframe animations
- `components.css` — buttons, inputs, cards, stat cards, badges, tables, toasts,
  alerts, skeletons, empty states, avatars
- `layout.css` — sidebar, mobile bottom nav, topbar, responsive grids
- `login.css` / `dashboard.css` — page-specific styles

All pages share the same token-driven design system, so new screens stay
consistent automatically.

## New Application Module

Field form at `/applications/new` (auth-protected) for recording a gold-loan
application:

- **Customer** — photo, name, 10-digit mobile, 12-digit Aadhaar (optional), address
- **Gold/Jewellery** — add/remove multiple items; per item: name, purity
  (18K/22K/24K/14K), weight in grams, description, photo. Total weight is
  calculated live.
- **Loan** — amount (₹), payment mode (Cash / Account segmented control), date

Photos are compressed to ~900px JPEG data URLs in the browser before upload
(`GM.compressImage` in `public/js/ui.js`) so records stay small enough for slow
field connections. If MongoDB is unreachable the API returns `503` gracefully.

## Records Module

List at `/records` and detail at `/records/:id` (both auth-protected):

- **List** — responsive: card grid on mobile, professional table on desktop;
  search across customer name, mobile, Aadhaar and application number
  (`GET /api/applications?search=…`); live count, skeleton/empty/error states.
- **Detail** — full record: customer + photo, every jewellery item with photos
  and total weight, loan amount/mode/date, status, recorded-by and timestamps.
- **Edit** — opens the New Application form in edit mode (`/applications/:id/edit`),
  pre-filled, saved via `PUT /api/applications/:id`.
- **Delete** — confirmation modal, `DELETE /api/applications/:id`.
- **A4 Print (hard copy)** — `Print A4` on the detail page opens a dedicated
  paper-document page at `/records/:id/print`: header with Gold Mitra brand and
  application number, application date / payment mode / status meta row, customer
  block with photo + name/mobile/Aadhaar/address, jewellery table with photo
  thumbnails, purity and per-item weights plus a bold total-weight row, the exact
  loan amount, declaration + customer acknowledgement and three signature
  sections (Field Officer / Reviewed by / Authorized Signatory), and a
  computer-generated footer (printed-by + terms). The screen preview is styled as
  a paper sheet; `@media print` sets `@page: size A4`, hides every UI element and
  prints only the document (`break-inside: avoid`, repeating table headers).

Non-admin staff only see records they recorded; admins see everything. Owners
and admins may edit/delete; others get `403`. The print page uses the same
access rules through the record API.

## Settings Module

Admin-only page at `/settings` (`GET /api/staff`, `POST /api/staff`,
`PATCH /api/staff/:id/active` — all guarded by `requireAdmin`):

- **Field team** — live list of every staff member with role, status and last login.
- **Add field employee** — create Field Officer / Manager users (name, email, optional
  phone, temporary password ≥8 chars). Duplicate emails are rejected (`409`).
- **Activate / Deactivate** — admins can immediately block access to a user (they can no
  longer sign in); admin cannot deactivate their own account.
- The **Settings** entry is only visible to admins (`data-admin-only` gating in `nav.js`),
  and the server redirects non-admins away from `/settings` and returns `403` on all staff APIs.
- Staff sign in with the same login page; deactivated accounts get `401`/"Invalid credentials".

## Production Hardening

- **Security headers** — `helmet` (HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, etc.). CSP stays disabled for this no-build app (inline styles,
  Google Fonts, data-URL photos) — see *Remaining issues*.
- **Session cookies** — `HttpOnly` + `SameSite=Lax` always; `Secure` in production.
  Production requires a real `SESSION_SECRET` (≥24 chars) or the app refuses to start.
- **CSRF defense** — every POST/PUT/PATCH/DELETE with an `Origin` header is rejected if it
  does not match the request `Host` (cross-site browser requests are blocked; non-browser
  clients are unaffected).
- **Login brute-force protection** — in-memory rate limiter: after 10 failed attempts the
  IP is blocked for 15 minutes (`429`).
- **API authorization** — `requireAuth` guards every private endpoint (401 for APIs,
  redirect for pages); owners/admins only for edit/delete; every mutation re-validates payloads.
- **Serverless-ready DB** — a lazy `/api` middleware opens (and caches) the Atlas connection
  on the first API call of a cold instance, so Vercel deployments work without a long-running
  process. `connectDB()` is idempotent and shares a single in-flight connection.
- **No localhost coupling** — the app uses relative URLs exclusively; the only `localhost`
  reference is a local dev console log.

## Testing

```bash
node server.js &                    # start the app
node test/workflow-test.js          # full journey + security: login, create, search, view,
                                    # edit, print pages, staff creation/activation, CSRF,
                                    # rate-limit, headers, logout
node test/e2e-application.js        # API-level create/read/update/delete assertions
```

Both suites run against your real `.env` (Atlas) config and clean up their test records.

## Remaining issues (accepted trade-offs)

- **In-memory sessions** on serverless — users may be signed out on instance churn. Fix:
  add `connect-mongo` (or a Redis store) as the session store.
- **CSP disabled** — if you later self-host fonts/assets and remove inline styles, enable a
  strict `helmet` CSP.
- **GET-based JSON APIs use session auth only** — acceptable for same-origin usage; a future
  token/JWT layer is optional.
- **Admin bootstrap** is idempotent but creates only the *first* admin (when staff is empty);
  create additional staff users via your own admin flow/Mongo for real teams.