# Role-Based Facility Reservation and Approval System

Systems Analysis and Design — **Laboratory 4 (Section B)**.

A role-based facility reservation system with an approval workflow, schedule
conflict protection and a full audit trail. Built as a static front-end
(GitHub Pages) backed by a Supabase (PostgreSQL) database with Row Level
Security, business-rule triggers and audit-log triggers.

## Features

- **Three roles** — Administrator, Facility Staff, Requester — controlled in
  the UI, in RPC functions, and by PostgreSQL Row Level Security.
- **Full approval workflow** — `Pending → Approved | Rejected → Scheduled →
  In Use → Completed`, plus `Cancelled`.
- **Business rules BR-B4-01 … BR-B4-10** enforced in the database (check
  constraints, triggers, role-guarded functions).
- **Overlap protection** — time-slot conflicts are rejected at submit and
  re-checked on approval/scheduling.
- **Audit logging (BR-B4-10)** — every submission, approval, rejection,
  cancellation, status change, facility update and deletion is written to
  `audit_logs` by triggers.
- **Reports** for the Administrator (reservations by status, facility usage).
- **Service requests** so staff can report facility concerns.

## Tech stack

| Layer     | Technology                                    |
| --------- | --------------------------------------------- |
| Front-end | HTML + CSS + vanilla JS (SPA, hash router)   |
| Backend   | Supabase (PostgreSQL, Auth, RLS, triggers)    |
| Hosting   | GitHub Pages                                   |

## Project structure

```
├── index.html                  # app shell
├── css/style.css               # styling
├── js/
│   ├── config.js               # <-- YOUR Supabase URL + anon key
│   ├── auth.js                 # Supabase auth client + session/profile
│   ├── api.js                  # data-access wrappers (RLS protected)
│   ├── ui.js                   # badges, tables, modals, toasts
│   ├── pages.js                # role-based screen renderers
│   └── app.js                  # router, shell, business actions
├── supabase/
│   ├── schema.sql              # full schema + RLS + rules + audit
│   └── seed.sql                # demo users, facilities, reservations
├── docs/
│   ├── ERD.md                  # entity relationship diagram (mermaid)
│   ├── USE_CASE_DIAGRAM.md     # use case diagram (mermaid)
│   ├── ROLE_PERMISSION_MATRIX.md
│   ├── WORKFLOW.md             # reservation workflow + transitions
│   ├── BUSINESS_RULES.md       # BR-B4-01..10 -> enforcement map
│   └── screenshots/            # required evidence
└── tests/
    └── TEST_RESULTS.md         # TC-B4-01..10 template
```

## Demo accounts (after seed.sql)

| Role        | Email                | Password     |
| ----------- | -------------------- | ------------ |
| Administrator | admin@example.com    | password123  |
| Facility Staff | staff@example.com    | password123  |
| Requester   | requester@example.com | password123 |
| Requester   | requester2@example.com | password123 |

---

## Setup guide

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project** (name:
   `facility-reservation`, region near you, strong DB password).
2. From **Project Settings → API**, copy the **Project URL** and the **anon**
   key.

### 2. Load the database schema + seed data

1. Open **SQL Editor** in the Supabase Dashboard.
2. Paste the entire contents of `supabase/schema.sql` → **Run**.
3. Paste `supabase/seed.sql` → **Run**.

> The seed creates demo users through `auth.users` and the
> `handle_new_user` trigger creates their profiles. If you prefer,
> skip the seed and instead sign up in the UI, then promote roles with
> `update public.profiles set role='administrator' where email='…';`.

### 3. Point the front-end at your project

Edit `js/config.js`:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-ref.supabase.co",
  anonKey: "YOUR-anon-public-key"
};
```

### 4. Run locally (optional)

```
python -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

### 5. Deploy to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Lab 4 Section B - Facility reservation & approval system"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. Repository → **Settings → Pages** → Source: **Deploy from a branch** →
   branch `main`, folder `/ (root)` → **Save**.
3. GitHub publishes to `https://<you>.github.io/<repo>/`.

> GitHub Pages can only serve files from the repo root; keep `js/`, `css/` and
> `index.html` at the root as structured here.

### 6. Verify

Follow `tests/TEST_RESULTS.md` (TC-B4-01 … TC-B4-10) using the demo accounts,
capture the **Audit Log** screenshot, and fill in the results.

---

## How the roles map to screens

| Page         | Requester | Staff | Administrator |
| ------------ | :-------: | :---: | :-----------: |
| Dashboard    | ✓         | ✓     | ✓             |
| Facilities   | ✓         | ✓     | ✓             |
| My Reservations | ✓      | —     | —             |
| Reservations (all) | —    | ✓     | ✓             |
| Approvals    | —         | —     | ✓             |
| Service Requests | —      | ✓     | ✓             |
| Users        | —         | —     | ✓             |
| Audit Logs   | —         | —     | ✓             |
| Reports      | —         | —     | ✓             |

## Security model (summary)

- **RLS** — requesters only `SELECT` their own reservations; `audit_logs` is
  administrator-only; direct `INSERT/UPDATE/DELETE` on `audit_logs` revoked.
- **Role-guarded RPCs** — every state-changing action verifies the caller's
  role inside a `SECURITY DEFINER` function.
- **Trigger-based rules + audit** — business rules and audit entries run in
  the database regardless of the calling path.
- The **anon key** is intentionally public (it is not a secret); the
  `service_role` key is never used in the front-end.

## Submission checklist

| Requirement                     | Where                                            |
| ------------------------------- | ------------------------------------------------ |
| GitHub repository URL           | your repository                                 |
| Live GitHub Pages URL           | Settings → Pages                                 |
| Updated ERD & Use Case Diagram  | `docs/ERD.md`, `docs/USE_CASE_DIAGRAM.md`        |
| Role-permission matrix          | `docs/ROLE_PERMISSION_MATRIX.md`                 |
| Reservation workflow            | `docs/WORKFLOW.md`                               |
| Business rules                  | `docs/BUSINESS_RULES.md` + `supabase/schema.sql` |
| Audit-log screenshot            | `docs/screenshots/`                              |
| Functional test results         | `tests/TEST_RESULTS.md`                          |