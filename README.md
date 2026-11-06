# Shifra Nuha CRM — Version 3

Internal CRM for **Shifra Nuha Technologies**. This is a production-minded, single-origin full-stack application: a React SPA served by the same Cloudflare Worker that exposes the JSON API, backed by Cloudflare D1.

Version 3 keeps the Version 1 platform foundation and the Version 2 Lead Management module, and adds complete Customer Management:

- Secure email/password authentication with server-side sessions
- Centralised role-based access control (owner / admin / employee)
- **Leads**: list, quick filters, search, sorting, pagination, create, edit and archive
- **Lead pipeline**: New → Contacted → Qualified → Proposal Sent → Negotiation → Won / Lost, with drag-and-drop and an accessible manual stage control
- **Lead detail**: contact information, contact status, activity timeline, quick actions and follow-ups
- **Follow-ups**: Today, Upcoming, Overdue and Completed views with complete, reschedule and cancel actions
- **Customers**: list, search, filters, status tabs, create, edit and archive
- **Customer detail**: overview, contacts, linked enquiries/leads, service history, notes and a permanent activity timeline
- **Lead-to-customer conversion**: only for Won leads, with duplicate detection, employee-confirmed linking or creation, and idempotent retries
- **Duplicate detection** by normalised phone/email/business name with an inspect-and-override flow
- Dashboard with **real** lead and customer metrics, pipeline overview, lead sources, customer growth, recent leads/customers and follow-ups
- Employee management (create, edit, activate, deactivate)
- Owner-only audit log and application settings
- Profile and change-password flows
- Disabled "Coming Soon" navigation for the remaining CRM modules
- Automated tests for security, permissions, lead workflows and every customer workflow

No fake authentication, hardcoded production secrets, fake statistics, invoices, projects, or public registration.

---

## Contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Roles and permissions](#roles-and-permissions)
- [Lead management](#lead-management)
- [Customer management](#customer-management)
- [Local development on Windows](#local-development-on-windows)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Seed data and owner bootstrap](#seed-data-and-owner-bootstrap)
- [Running the app](#running-the-app)
- [Scripts](#scripts)
- [API reference](#api-reference)
- [Security model](#security-model)
- [Testing](#testing)
- [Production deployment](#production-deployment)
- [Custom domain](#custom-domain)
- [Troubleshooting](#troubleshooting)
- [Version 3 scope](#version-3-scope)
- [Project structure](#project-structure)

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript (strict), Vite 8, Tailwind CSS 4, Lucide icons |
| Routing / data | React Router 7, TanStack Query 5 |
| API | Cloudflare Workers, Hono 4, Zod 4 |
| Database | Cloudflare D1 (SQLite), Drizzle ORM + Drizzle Kit migrations |
| Auth | PBKDF2-HMAC-SHA256 password hashing, server-side sessions, HttpOnly cookies |
| Tooling | Wrangler 4, `@cloudflare/vite-plugin`, Vitest 4 + `@cloudflare/vitest-plugin` |
| Hosting | Single Worker + static assets, custom domain `crm.shifranuhatech.com` |

---

## Architecture

```
Browser
  │
  ├── GET /employees, /settings, ...  ──► Worker static assets ──► index.html (SPA fallback)
  │
  └── /api/*                          ──► Worker (Hono) ──► D1
```

- The Worker is configured with `assets.run_worker_first: ["/api/*"]`, so only API
  traffic reaches Hono. Every other path is served by the asset server, which
  falls back to `index.html` for client-side routes.
- All API responses use a consistent envelope:
  - success: `{ "data": ... }`
  - error: `{ "error": { "code", "message", "details?" } }`
- Sessions are stored in D1. Only a SHA-256 hash of the session token is stored;
  the raw token lives in an `HttpOnly`, `Secure` (production), `SameSite=Lax`
  cookie.
- Mutations require both a CSRF double-submit token (`sn_csrf` cookie +
  `X-CSRF-Token` header) and an `Origin` header matching the application origin.
- RBAC is enforced on the server. The client mirrors permissions only to hide or
  show controls; it is never the authority.

---

## Roles and permissions

| Capability | Owner | Admin | Employee |
| --- | :---: | :---: | :---: |
| View dashboard | ✅ | ✅ | ✅ (own scope) |
| View employee directory | ✅ | ✅ | — |
| Create employees | ✅ | ✅ (employees only) | — |
| Edit employee details | ✅ | ✅ (employees only) | — |
| Change roles | ✅ | — | — |
| Activate / deactivate employees | ✅ | ✅ (employees only) | — |
| View audit log | ✅ | — | — |
| Manage application settings | ✅ | — | — |
| Update own profile | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| View leads | ✅ (all) | ✅ (all) | ✅ (assigned or created) |
| Create leads | ✅ | ✅ | ✅ (auto-assigned to self) |
| Edit leads / log activity | ✅ | ✅ | ✅ (assigned only) |
| Change stage | ✅ | ✅ | ✅ (assigned only) |
| Assign / reassign leads | ✅ | ✅ | — |
| Archive leads | ✅ | ✅ | — |
| View follow-ups | ✅ (all) | ✅ (all) | ✅ (assigned or created) |
| Create / complete / reschedule follow-ups | ✅ | ✅ | ✅ (own scope) |
| View customers | ✅ (all) | ✅ (all) | ✅ (assigned or created) |
| Create customers | ✅ | ✅ | ✅ (auto-assigned to self) |
| Edit customers, contacts, notes and activities | ✅ | ✅ | ✅ (own scope) |
| Assign / reassign customers | ✅ | ✅ | — |
| Archive / restore customers | ✅ | ✅ | — |
| Link leads / convert Won leads | ✅ | ✅ | ✅ (own scope) |

Protection rules enforced in `src/server/auth/permissions.ts`:

- The owner account cannot be modified or deactivated through user-management endpoints.
- Admins cannot modify owners or other admins.
- No one can change their own role or deactivate themselves.
- Ownership cannot be assigned through the API. The first owner is created by the
  protected bootstrap CLI.
- Admins can only create/assign the `employee` role.

Lead visibility is also enforced on the server, not just hidden in the UI:

- Owners and admins can view, edit, assign and archive every lead.
- Employees can view leads they are assigned to or created.
- Employees can edit a lead, log activity and change its stage only when they are
  the assigned owner of that lead.
- Employees cannot reassign or archive leads.
- Employees only see and manage follow-ups tied to leads they can access.
- Trying to access another employee's lead returns `404`, avoiding information
  leaks about whether the record exists.

Customer visibility follows the same server-enforced pattern:

- Owners and admins can view, edit, assign, archive and restore every customer.
- Employees can access customers where they are the assignee **or** the creator.
- Employees cannot reassign, archive or restore customers.
- Duplicate detection remains team-wide so accidental duplicates are caught, but
  restricted matches are masked to a customer number and last four phone digits.
  Employees must ask an owner or admin to open or link the restricted record.
- Customer-linked leads, contacts, notes and activity history inherit the same
  record-level access check.

---

## Lead management

### Pipeline stages

`New → Contacted → Qualified → Proposal Sent → Negotiation → Won / Lost`

- Stages are validated against the shared vocabulary in
  `src/shared/constants/leads.ts` on both client and server.
- Selecting the current stage is rejected as a no-op.
- Moving from `Won` to `Lost` (or vice versa) is rejected; reopen a closed lead
  first by moving it to an open stage.
- Marking a lead `Lost` requires a lost reason.
- Moving a closed lead back to an open stage records a **reopen** rather than a
  normal stage change. `convertedAt` is set when a lead is won and cleared when a
  closed lead is reopened.
- Every transition writes a `lead_activities` row and an audit event. Normal
  transitions use `lead.stage_changed`; terminal transitions use
  `lead.won`, `lead.lost` or `lead.reopened`.

The pipeline board uses `@dnd-kit/core` for drag-and-drop. Dropping a card
persists the stage optimistically and reverts the card with a toast if the API
rejects the move. A manual "Change stage" action is always available for mobile
and keyboard users.

### Contact status

Contact status is tracked independently from the pipeline stage:

- `Not Contacted`
- `Attempted`
- `Contacted`

Logging a call, WhatsApp, email or meeting automatically moves a lead to
`Contacted` (unless the user explicitly chooses a status). An employee can
override the status manually at any time. A lead in `Not Contacted` can still
have a pipeline stage; the two fields describe different things.

### Follow-ups

Follow-ups are separate records in `lead_follow_ups`:

- **Today** — pending follow-ups within the current Asia/Kolkata calendar day
- **Upcoming** — pending follow-ups after today
- **Overdue** — pending follow-ups before today
- **Completed** — completed follow-ups (the audit trail is preserved)

Completing, rescheduling or cancelling a follow-up never deletes the original
record. The lead's `next_follow_up_at` is kept in sync with the earliest pending
follow-up. Rescheduling writes a `lead.follow_up_rescheduled` activity; other
edits write `lead.follow_up_updated`.

### Duplicate detection

Phone numbers are normalised to digits (without assuming a country code) and
emails are lower-cased and trimmed. Creating a lead checks for an existing lead
with the same normalised phone or email:

- The API returns `409 possible_duplicate` with a `duplicates` list.
- The form shows the existing leads and lets the user inspect them.
- The user can explicitly choose "Create anyway", which sends
  `allowDuplicate: true`.

`GET /api/leads/check-duplicate` exposes the same lookup for the form.

### Lead sources and services

Lead sources are shared configuration in `src/shared/constants/leads.ts`
(Facebook Ads, Instagram Ads, WhatsApp, Website, Phone Call, Referral, Walk-in,
Other).

Service interest uses the reusable Shifra catalogue in
`src/shared/constants/services.ts`, grouped into Business Solutions, Digital
Solutions and Branding & Creative, plus `Other`. The future Projects module is
expected to reuse the same catalogue.

### Time and currency

Timestamps are stored in UTC and displayed in **Asia/Kolkata** by the client.
Estimated values are stored as numbers and displayed in **INR**.

---

## Customer management

### Customer records

Customers are stored in `customers` with UUID IDs and a unique human-readable
number in the form `SN-CUS-0001`. Individual and business customers share the
same record shape; business customers also store a business name.

- Numbers come from the database-backed `customer_number_sequence` table and are
  allocated atomically. They are never reused, including after archival.
- Phone numbers are stored as entered and normalised to digits for matching.
  Emails are stored lowercase; a customer must keep a phone number or email.
- Status is `active`, `inactive` or `archived`. Archiving is a soft archive that
  preserves contacts and the complete history. Restoring returns the customer to
  its previous active/inactive status.
- Assignment and audit fields track the assignee, creator and timestamps.
- All list, detail, update, archive and restore operations enforce customer
  record access on the server.

The client exposes `/customers` with All / Active / Inactive / Archived tabs,
search, type and assignee filters, sorting and pagination, plus
`/customers/:id` with Overview, Contacts, Enquiries & Leads, Service History and
Activity Timeline tabs.

### Contacts

A customer can have multiple contacts in `customer_contacts`. Exactly one primary
contact is enforced in two places:

- service validation when adding, editing or removing contacts
- a partial unique index on `(customer_id)` where `is_primary = 1`

When a new primary contact is chosen the previous primary is demoted. Removing
the primary promotes another contact when one exists. Contact removal keeps the
timeline entry and never deletes history.

### Notes and activity history

`customer_activities` is an append-only timeline. Notes and manually logged
interactions are new rows; existing entries are never overwritten or deleted.
Supported activity types include customer creation/update/status/assignment,
contact changes, notes, calls, WhatsApp, email, meetings, lead links, lead
conversions, archive and restore.

The UI supports notes and manual call/WhatsApp/email/meeting interactions. A
`note` interaction is stored as `note_added`.

### Duplicate detection

Customer creation, customer updates and lead conversion compare normalised
phone, normalised email and normalised business name against active **and**
inactive customers (archived records are excluded):

- A match returns `409 possible_duplicate` with
  `error.details.duplicates` and `error.details.canOverride`.
- The response includes the matched fields (`phone`, `email`, `business_name`).
- An authorised user may retry with `allowDuplicate: true`.
- Records outside the actor's access scope are returned masked: no personal
  name, email or full phone number, and they cannot be linked or opened.
- There is no automatic merge. Choosing to create a separate record is always an
  explicit employee decision.

`GET /api/customers/duplicates?phone=...&email=...&businessName=...` exposes the
same lookup to the form.

### Lead conversion and service history

Only leads in the **Won** stage can be converted. The conversion API is available
at `POST /api/leads/:id/convert-to-customer` and requires an explicit mode:

- `{ "mode": "link", "customerId": "..." }` links the Won lead to an existing,
  accessible, non-archived customer.
- `{ "mode": "create", "confirmCreate": true, "customer": { ... } }` creates a new
  customer from the Won lead after the employee reviews prefilled fields.
- If matching customers exist, creation also requires
  `allowDuplicate: true`.
- Without `confirmCreate`, the API returns `400 confirmation_required`. Nothing
  is created automatically.
- Conversion is idempotent. Once linked, retries return the same customer with
  `alreadyLinked: true`, even if two requests race.
- A failed link claim cleans up any customer that was just created in that request.
- Won leads converted this way receive `converted_to_customer_at`; the customer
  timeline receives a `lead_converted` entry.

`POST /api/customers/:id/leads` links any accessible, non-archived lead as an
enquiry. Linking an already-linked lead to the same customer is idempotent; linking
it to a different customer returns `409 lead_already_linked`.

Customer service history is derived from linked leads, not invented data:

- **Enquiries** are all linked leads.
- **Won purchases** are linked leads in the Won stage.
- Estimated values come from the lead records.
- No projects, invoices or payments are created by the customer module.

### Customer dashboard

`GET /api/dashboard/customer-stats` returns scoped counts (total, active, inactive,
archived, new this month, business/individual), six-month new-customer growth,
recent customers and recent customer activity. Owners and admins see the
organisation; employees see only their own scope. The same payload is included
in `/api/dashboard/stats` as `customerStats`.

---

## Local development on Windows

### Prerequisites

- **Node.js 20.19+ or 22.12+** (required by Vite 8 and Wrangler 4)
- **npm 10+**
- PowerShell 7 or Windows PowerShell 5.1
- No Cloudflare account is required for local development.

### 1. Install dependencies

```powershell
cd "C:\Anas\games\job works\Shifra_CRM"
npm install
```

### 2. Create local environment variables

```powershell
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars` is gitignored and contains only local, non-secret settings.

### 3. Apply migrations to the local D1 database

```powershell
npm run db:migrate:local
```

Local state is persisted under `.wrangler\state\v3` and is gitignored. The
migration command **never** touches a production database.

### 4. Seed local development data (optional but recommended)

```powershell
npm run db:seed
```

This creates three users with known development-only passwords:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@shifranuha.dev` | `Owner#12345!` |
| Admin | `admin@shifranuha.dev` | `Admin#12345!` |
| Employee | `employee@shifranuha.dev` | `Employee#12345!` |

> These credentials exist **only** for local development. The seed script refuses
> to run with `--remote` and never writes to a deployed database.

The seed is idempotent: re-running it does not duplicate users.

### 4b. Seed local demo leads (optional)

```powershell
npm run db:seed:leads
```

This inserts realistic demo leads, activities, follow-ups and audit entries
linked to the three seed users. The data covers every pipeline stage, all contact
statuses, overdue/today/upcoming/completed follow-ups, won/lost leads and
assigned as well as unassigned leads.

- Local-only: the script refuses `--remote` and never writes to a deployed
  database.
- Re-running it **refreshes only the demo leads** by their deterministic IDs, so
  relative follow-up dates stay useful. Leads created through the application
  are never touched.
- Run `npm run db:seed` first if the development users do not exist.

### 4c. Seed local demo customers (optional)

```powershell
npm run db:seed:customers
```

This inserts six realistic business customers, contacts, notes, activity history,
one inactive record, one archived record and customer audit entries. When the
lead demo seed is also present, the corresponding won/enquiry leads are linked so
the Enquiries & Leads and Service History tabs have realistic examples.

- Local-only: the script refuses `--remote`.
- Re-running it refreshes only its deterministic demo customers.
- Demo customers use `SN-CUS-9001` through `SN-CUS-9006`; the customer number
  sequence is advanced past that range so app-created numbers stay sequential.
- Run `npm run db:seed` first, and optionally `npm run db:seed:leads`.

### 5. Start the development server

```powershell
npm run dev
```

Open <http://localhost:5173>. The Vite dev server runs the Worker and local D1
through the Cloudflare Vite plugin, with hot reload for the client.

---

## Environment variables

Local values live in `.dev.vars` (gitignored). Production values live in
`wrangler.jsonc` under `vars`. None of these are secrets.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `production` enables `Secure` cookies |
| `APP_URL` | `http://localhost:5173` | Trusted origin for CSRF origin checks |
| `SESSION_TTL_HOURS` | `168` | Absolute session lifetime (1–720) |
| `SESSION_IDLE_MINUTES` | `480` | Idle timeout (5–10080) |
| `TELEGRAM_REMINDERS_ENABLED` | `true` | Enables the scheduled reminder sweep when Telegram is configured |
| `TELEGRAM_BOT_TOKEN` | *(secret)* | Telegram bot token — **set with `wrangler secret put`, never committed** |
| `TELEGRAM_CHAT_ID` | *(secret/target)* | Telegram chat/group ID for reminders — **set with `wrangler secret put` in production** |

Do not commit `.dev.vars`, `.env`, bot tokens, or any real credentials. For
production/staging, store Telegram secrets with Wrangler:

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

---

## Database migrations

Schema source of truth: `src/server/db/schema.ts`.

Generate a migration after schema changes:

```powershell
npm run db:generate
```

Apply migrations locally:

```powershell
npm run db:migrate:local
```

Apply migrations to the deployed database:

```powershell
npm run db:migrate:remote
```

`migrations/0000_flashy_psynapse.sql` creates the V1 platform tables:

- `users` — UUID primary key, unique lowercase email, role check constraint,
  single-owner partial unique index, active flag, `must_change_password`,
  timestamps, indexes on role/active/created date
- `sessions` — UUID primary key, unique token hash, user FK with cascade delete,
  absolute expiry, last activity, indexes on user/expiry
- `audit_logs` — UUID primary key, actor FK with `SET NULL`, action/entity
  metadata, JSON validity check, indexes on actor/action/date/entity
- `login_attempts` — throttling history with indexes on email/IP/date
- `app_settings` — key/value settings with updater FK

`migrations/0001_lazy_preak.sql` adds the V2 lead tables:

- `leads` — unique lead number, normalised phone/email columns for duplicate
  detection, pipeline stage, contact status, priority and source checks, service
  interest/category, assignment and creator FKs with `SET NULL`, estimated value,
  lost reason, next follow-up, last contacted/converted timestamps, soft-delete
  `deleted_at`, and indexes for stage, contact status, assignment, follow-up
  date, source, service, priority and archive filtering
- `lead_activities` — timeline entries linked to the lead (cascade delete) and
  actor (`SET NULL`), activity-type/stage checks, indexes for lead timeline and
  activity type
- `lead_follow_ups` — scheduled follow-ups linked to the lead and assignee with
  status/date/completion checks and indexes for scope queries. Completed rows
  require `completed_at`.

`migrations/0002_great_grandmaster.sql` adds the V3 customer tables and lead
linkage:

- `customer_number_sequence` — atomic key/value sequence for `SN-CUS-*` numbers.
  The migration seeds the `customer` key at `0`; rows must not be deleted.
- `customers` — UUID ID, unique customer number, individual/business type,
  normalised phone/email/business-name columns, address fields, active/inactive/
  archived status with archive timestamp, previous status before archive,
  assignment/creator FKs with `SET NULL`, timestamps, and indexes for duplicate
  detection, status, type, assignment, creator, dates and archival.
- `customer_contacts` — multiple contacts per customer, contact details, primary
  flag, audit fields, and a partial unique index enforcing at most one primary
  contact per customer.
- `customer_activities` — append-only timeline with actor, type, title,
  description, JSON metadata, optional lead/contact context, and timeline indexes.
- `leads` gains `customer_id` and `converted_to_customer_at`, allowing Won leads
  to be linked to the customer they converted into.

`migrations/0004_tasks.sql` and `migrations/0005_task_activities.sql` add the
Tasks & Follow-ups + Telegram reminder module:

- `tasks` — UUID ID, unique `SN-TASK-*` number, title/description, type,
  status/priority, assignee/creator, optional lead/customer/project link, due
  date, completion/cancellation timestamps, reminder fields (`enabled`,
  `minutes_before`, `sent/attempted/status/error`), recurrence fields
  (`type/interval/end_at/group_id`), and indexes for common filters.
- `task_number_sequence` — atomic sequence for `SN-TASK-*` numbers.
- `task_activities` — append-only task history (created/updated/assigned,
  rescheduled, completed/reopened/cancelled, etc.) with metadata and actor.

The Worker runs a scheduled cron (`* * * * *`, see `wrangler.jsonc`) that calls
the reminder sweep: it computes `reminder_at = due_at - reminder_minutes_before`,
skips completed/cancelled/already-sent tasks, retries failed sends with backoff,
and stores delivery status without exposing secrets to the frontend.

---

## Seed data and owner bootstrap

### Development seed

```powershell
npm run db:seed
```

Local-only, idempotent, refuses remote execution. See the credentials table above.

### Lead demo seed

```powershell
npm run db:seed
npm run db:seed:leads
```

Local-only and refuses remote execution. The lead seed is safe to re-run: it
refreshes its own deterministic demo records without touching leads created in
the application. See [Local development](#local-development-on-windows).

### Customer demo seed

```powershell
npm run db:seed
npm run db:seed:leads
npm run db:seed:customers
```

Local-only and refuses remote execution. The customer seed refreshes six
deterministic demo customers and their contacts/activity history without touching
customers created in the application. It also links matching demo leads when they
exist. Demo numbers start at `SN-CUS-9001`; the sequence is advanced so new
customers continue after them.

### Owner bootstrap (non-seed environments)

The only supported way to create the first owner is the protected CLI:

```powershell
npm run auth:bootstrap -- --local
```

For a deployed database:

```powershell
npm run auth:bootstrap -- --remote
```

The script:

- Refuses to create a second owner
- Validates name, email, and password policy
- Hashes the password with PBKDF2-HMAC-SHA256 (100,000 iterations, the Cloudflare Workers maximum)
- Creates default application settings
- Writes an audit entry
- Never prints the password

For non-interactive use, set `OWNER_NAME`, `OWNER_EMAIL`, and `OWNER_PASSWORD`
in the shell environment. Remote runs additionally require `--yes` when
non-interactive:

```powershell
$env:OWNER_NAME = "Amina Yusuf"
$env:OWNER_EMAIL = "owner@shifranuhatech.com"
$env:OWNER_PASSWORD = "use-a-strong-unique-password"
npm run auth:bootstrap -- --remote --yes
```

After the first owner exists, create admins and employees through the UI/API.

---

## Running the app

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite + local Worker + local D1 at `http://localhost:5173` |
| `npm run build` | Type-check, build the SPA and Worker, remove local `.dev.vars` from output |
| `npm run preview` | Preview the production build locally (uses production config) |
| `npm run typecheck` | TypeScript project build check |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |

The production build is written to `dist/`. `scripts/clean-build.mjs` removes any
local `.dev.vars` copied into the build output before deployment.

> `npm run preview` runs the built Worker with the production `APP_URL`
> (`https://crm.shifranuhatech.com`). The Origin guard will therefore reject
> sign-in attempts from `http://localhost:4173`. Use `npm run dev` for functional
> local testing; use `preview` to verify the production build and SPA fallback.

---

## API reference

All endpoints are under `/api`. Authenticated endpoints require the session
cookie. Mutations additionally require the `X-CSRF-Token` header.

### Auth

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | Sign in; sets session + CSRF cookies |
| `POST` | `/api/auth/logout` | Authenticated | Destroy the current session |
| `GET` | `/api/auth/me` | Authenticated | Current user, permissions, CSRF token |
| `POST` | `/api/auth/change-password` | Authenticated | Change password; rotates the session |
| `PATCH` | `/api/auth/profile` | Authenticated | Update own full name |

### Users

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users` | `users:read` | Paginated list with `search`, `role`, `status` |
| `GET` | `/api/users/:id` | `users:read` | User detail |
| `POST` | `/api/users` | `users:create` | Create user (`employee` or, for owner, `admin`) |
| `PATCH` | `/api/users/:id` | `users:update` | Update name and/or role |
| `POST` | `/api/users/:id/deactivate` | `users:deactivate` | Deactivate and invalidate sessions |
| `POST` | `/api/users/:id/activate` | `users:activate` | Reactivate |

### Dashboard, audit, settings

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/stats` | `dashboard:view` | Employee stats, module placeholders, `leadStats`, `customerStats`, recent activity |
| `GET` | `/api/dashboard/lead-stats` | `dashboard:view` | Lead KPIs, pipeline, sources, conversion, recent leads and follow-ups |
| `GET` | `/api/dashboard/customer-stats` | `dashboard:view` | Customer counts, six-month growth, recent customers and activity |
| `GET` | `/api/audit-logs` | `audit:read` | Paginated audit log with filters |
| `GET` | `/api/settings` | `settings:manage` | Application settings |
| `PATCH` | `/api/settings` | `settings:manage` | Update application settings |
| `GET` | `/api/health` | Public | Health/environment check |

### Leads

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/leads` | `leads:read` | Paginated, filtered, sorted lead list |
| `GET` | `/api/leads/:id` | `leads:read` | Lead detail with assignment and follow-up summary |
| `GET` | `/api/leads/pipeline` | `leads:read` | Pipeline columns with counts and limited cards |
| `GET` | `/api/leads/check-duplicate` | `leads:read` | Duplicate lookup by `phone` and/or `email` |
| `POST` | `/api/leads` | `leads:create` | Create a lead (employee leads auto-assign to creator) |
| `PATCH` | `/api/leads/:id` | `leads:update` | Update lead fields and manual contact status |
| `POST` | `/api/leads/:id/stage` | `leads:stage` | Change stage; lost requires a reason |
| `POST` | `/api/leads/:id/assign` | `leads:assign` | Assign or unassign a lead |
| `GET` | `/api/leads/:id/activities` | `leads:read` | Paginated activity timeline |
| `POST` | `/api/leads/:id/activities` | `leads:update` | Log a call, WhatsApp, email, meeting or note |
| `POST` | `/api/leads/:id/follow-ups` | `followups:create` | Schedule a follow-up |
| `POST` | `/api/leads/:id/convert-to-customer` | `customers:link_leads` | Link or create a customer for a Won lead |
| `DELETE` | `/api/leads/:id` | `leads:archive` | Soft-delete (archive) a lead |

Lead list query parameters:

- Pagination: `page`, `pageSize` (1–100)
- Search: `search` (lead number, name, phone, email, business, location)
- Filters: `pipelineStage`, `contactStatus`, `source`, `serviceInterest`,
  `assignedTo`, `priority`
- Quick filters: `quickFilter` = `all | new | not_contacted | contacted |
  follow_up_due | overdue | my_leads | won | lost`
- Scope/sort: `scope` = `all | my`, `sortBy` = `created_at |
  next_follow_up_at`, `sortDir` = `asc | desc`, `includeArchived`

`follow_up_due` uses the current Asia/Kolkata day. `overdue` uses the exact
current time; a follow-up due later today can therefore appear in both views.

Creating a lead with a matching normalised phone or email returns
`409 possible_duplicate` with `error.details.duplicates`. Send
`allowDuplicate: true` to create it anyway.

All lead and follow-up mutations enforce the same rules for both roles and
record-scope that the list endpoints use.

### Customers

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/customers` | `customers:read` | Paginated, filtered, sorted customer list |
| `GET` | `/api/customers/:id` | `customers:read` | Detail with contacts, linked leads, stats and timeline summary |
| `GET` | `/api/customers/duplicates` | `customers:read` | Duplicate lookup by phone, email and/or business name |
| `POST` | `/api/customers` | `customers:create` | Create a customer and its primary contact |
| `PATCH` | `/api/customers/:id` | `customers:update` | Update fields/status; assignment needs `customers:assign` |
| `POST` | `/api/customers/:id/archive` | `customers:archive` | Soft-archive a customer |
| `POST` | `/api/customers/:id/restore` | `customers:archive` | Restore to the pre-archive status |
| `GET` | `/api/customers/:id/contacts` | `customers:read` | Contact list |
| `POST` | `/api/customers/:id/contacts` | `customers:contacts` | Add a contact |
| `PATCH` | `/api/customers/:id/contacts/:contactId` | `customers:contacts` | Update a contact |
| `DELETE` | `/api/customers/:id/contacts/:contactId` | `customers:contacts` | Remove a contact and keep history |
| `GET` | `/api/customers/:id/activities` | `customers:read` | Paginated, filterable activity timeline |
| `POST` | `/api/customers/:id/activities` | `customers:notes` | Log a call, WhatsApp, email, meeting or note |
| `GET` | `/api/customers/:id/notes` | `customers:read` | Paginated notes |
| `POST` | `/api/customers/:id/notes` | `customers:notes` | Append a note |
| `GET` | `/api/customers/:id/leads` | `customers:read` | Linked leads and service-history counts |
| `POST` | `/api/customers/:id/leads` | `customers:link_leads` | Link an accessible lead as an enquiry |

Customer list query parameters:

- Pagination: `page`, `pageSize` (1–100)
- Search: `search` (customer number, name, business, phone, email)
- Filters: `status` = `active | inactive | archived`, `type` =
  `individual | business`, `assignedTo`
- Scope/sort: `scope` = `all | my`, `sortBy` =
  `created_at | updated_at | name | customer_number`, `sortDir` = `asc | desc`
- Archived visibility: `includeArchived`

Customer creation returns `201` with `{ "data": { "customer": ... } }`.
Duplicate creation/update returns `409 possible_duplicate` with
`error.details.duplicates` and `error.details.canOverride`; retry with
`allowDuplicate: true`. Archived customers reject edits, contact changes, notes,
lead links and conversion until restored.

### Follow-ups

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/follow-ups` | `followups:read` | Paginated list by scope/status/assignee/lead |
| `GET` | `/api/follow-ups/counts` | `followups:read` | Today, upcoming, overdue and completed counts |
| `PATCH` | `/api/follow-ups/:id` | `followups:update` | Edit title, notes, schedule or assignee |
| `POST` | `/api/follow-ups/:id/reschedule` | `followups:update` | Move to a new date/time |
| `POST` | `/api/follow-ups/:id/complete` | `followups:update` | Mark complete with an optional note |
| `POST` | `/api/follow-ups/:id/cancel` | `followups:update` | Cancel with an optional reason |

Follow-up list query parameters: `page`, `pageSize`, `scope` = `all | today |
upcoming | overdue | completed | cancelled`, `status`, `assignedTo`, `leadId`,
`search`.

Pagination responses use:

```json
{
  "data": {
    "items": [],
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
}
```

List query parameters: `page` (≥1), `pageSize` (1–100). User list also supports
`search`, `role` (`owner|admin|employee`), and `status` (`active|inactive`).
Audit list supports `action`, `userId`, `from`, and `to` (ISO timestamps).

---

## Security model

- **Password hashing** — PBKDF2-HMAC-SHA256, 100,000 iterations, unique 16-byte
  salt, stored as `pbkdf2_sha256$100000$<salt>$<hash>`. Comparison is
  timing-safe. 100,000 is the maximum PBKDF2 iteration count supported by the
  production Cloudflare Workers Web Crypto runtime; Node and `wrangler dev` do
  not enforce that ceiling, so production always needs to be verified.
- **Session tokens** — 32 random bytes (hex). The database stores only a SHA-256
  hash. Session cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure`
  when `ENVIRONMENT=production`.
- **Session fixation** — any pre-login session is destroyed before a new
  authenticated session is issued.
- **Session invalidation** — logout deletes the session; password changes and
  deactivations invalidate all of the user's sessions.
- **Absolute + idle expiry** — sessions expire after `SESSION_TTL_HOURS` and
  after `SESSION_IDLE_MINUTES` without activity.
- **CSRF** — double-submit cookie plus `X-CSRF-Token`, with timing-safe
  comparison, and an `Origin` allow-list for unsafe methods.
- **Login throttling** — 5 failed attempts per email or 20 per IP within 15
  minutes trigger a temporary lockout. Login errors stay generic so they do not
  reveal whether an email exists.
- **No public registration** — accounts are created only by authorised users or
  the bootstrap CLI.
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, API CSP, and `Cache-Control: no-store`.
- **Audit trail** — authentication, user management, password changes, profile
  updates, settings changes and every lead workflow are recorded. Stage changes,
  assignments, interactions, won/lost/reopen events and follow-up actions each
  produce a distinct audit event without duplicating the activity timeline entry.
- **Lead access control** — lead and follow-up access is scoped in the query
  layer by assignment/creator for employees, then re-checked before mutations.
- **Customer access control** — customer, contact, note, activity and linked-lead
  access is scoped by assignment/creator for employees and re-checked before every
  mutation. Duplicate matches outside the actor's scope are masked, and assigning,
  archiving or restoring customers requires explicit permissions.
- **Conversion safety** — conversion never creates a customer without an explicit
  employee confirmation, refuses non-Won leads, and records an audit/activity
  event. Duplicate overrides are explicit and no automatic merging occurs.

---

## Testing

```powershell
npm test
```

The suite uses Vitest with the Cloudflare Workers pool and applies the real D1
migrations to an isolated test database. Tests run with `ENVIRONMENT=production`
and `APP_URL=https://crm.shifranuhatech.com` to exercise the production cookie
policy.

Covered areas (66 tests across 9 suites):

- Password hashing format, verification, salting, and policy
- Login success/failure, generic errors, throttling behaviour
- Session creation, expiry, logout, and unauthorized access
- RBAC, owner protection, admin boundaries, self-protection
- Employee creation, updates, activation/deactivation, session invalidation
- Database constraints (single owner, lowercase email, role checks, FKs)
- Dashboard statistics and coming-soon module markers
- Settings read/update permissions
- CSRF and origin checks
- Lead creation, validation, phone/email normalisation and duplicate override
- Lead list pagination, filtering, searching, sorting and quick filters
- Employee lead visibility and mutation boundaries
- Pipeline stage changes, lost reason, won/lost and reopen behaviour
- Activity logging, automatic contact status and audit entries
- Follow-up creation, scopes, counts, completion, reschedule and cancel
- Lead dashboard statistics and conversion metrics
- Customer creation, sequential numbers, primary-contact creation and lifecycle
- Customer update, archive, restore, duplicate detection and explicit override
- Multi-contact primary invariant at the service and database-index layer
- Employee customer visibility, assignment/archive restrictions and masked matches
- Append-only customer notes and activity history
- Won-lead conversion eligibility, confirmation, linking, duplicate handling and idempotency
- Customer dashboard metrics and employee scoping

The customer suite is `tests/customers.test.ts`. Run a single file with:

```powershell
npx vitest run tests/leads.test.ts
```

---

## Production deployment

### Prerequisites

- A Cloudflare account with access to the `shifranuhatech.com` zone
- Wrangler authenticated locally
- Real D1 database IDs

### 1. Authenticate Wrangler

```powershell
npx wrangler login
```

### 2. Create the production D1 database

```powershell
npx wrangler d1 create shifra-nuha-crm
```

Copy the returned `database_id` and replace the placeholder in
`wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "shifra-nuha-crm",
    "database_id": "<REAL_PRODUCTION_DATABASE_ID>",
    "migrations_dir": "migrations"
  }
]
```

### 3. Apply migrations to the remote database

```powershell
npm run db:migrate:remote
```

### 4. Create the first production owner

```powershell
$env:OWNER_NAME = "Owner Full Name"
$env:OWNER_EMAIL = "owner@shifranuhatech.com"
$env:OWNER_PASSWORD = "a-strong-unique-password"
npm run auth:bootstrap -- --remote --yes
```

Remove the environment variables from the shell afterwards:

```powershell
Remove-Item Env:OWNER_PASSWORD
```

### 5. Deploy

```powershell
npm run deploy
```

This runs the type-check/build (including removal of `.dev.vars` from `dist/`)
and then `wrangler deploy`.

The Worker name is `shifra-nuha-crm`; the configured route is
`crm.shifranuhatech.com`.

### Staging (optional)

Create a separate staging D1 database, replace the staging placeholder ID in
`wrangler.jsonc`, apply migrations, bootstrap a staging owner, then:

```powershell
npm run deploy:staging
```

Staging uses `shifra-nuha-crm-staging` and
`staging.crm.shifranuhatech.com`. Do not reuse production credentials or the
development seed there.

---

## Custom domain

`wrangler.jsonc` already declares:

```jsonc
"routes": [
  { "pattern": "crm.shifranuhatech.com", "custom_domain": true }
]
```

On deploy, Cloudflare attaches the custom domain if the zone is active in the
same account. If you prefer to attach it manually, remove the `routes` block and
add the domain from **Workers & Pages → shifra-nuha-crm → Settings → Domains &
Routes**.

Verify after deployment:

```powershell
curl.exe https://crm.shifranuhatech.com/api/health
```

---

## Troubleshooting

### `GET /employees` returns JSON 404 instead of the app

The Worker must only run first for API routes. Confirm `wrangler.jsonc` contains:

```jsonc
"assets": {
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api/*"]
}
```

Then restart `npm run dev`.

### `The users table does not exist`

Apply migrations first:

```powershell
npm run db:migrate:local
```

### Port 5173 already in use

Find and stop the process:

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Login fails with seeded credentials

The seed may not have run, or the local database may have been reset. Re-run:

```powershell
npm run db:migrate:local
npm run db:seed
```

### Production login fails with `invalid_credentials` but the user exists

Cloudflare Workers' Web Crypto implementation rejects PBKDF2 iteration counts
above 100,000. `verifyPassword` treats that runtime error as a failed password,
so a hash created with a higher iteration count (for example an older 600,000
iteration owner hash) fails only in production. Node, browsers and
`wrangler dev` do not enforce the cap, which is why the same login can work
locally.

Confirm the cause with a live Worker log:

```powershell
npx wrangler tail shifra-nuha-crm --format pretty
```

Look for `Pbkdf2 failed: iteration counts above 100000 are not supported`. To fix
an existing account, regenerate its hash with the current 100,000-iteration
implementation using the reset script, then deploy the current code:

```powershell
$env:OWNER_PASSWORD = "your-current-password"
npx tsx scripts/reset-owner-password.ts --remote --yes
Remove-Item Env:OWNER_PASSWORD
```

Set `AUTH_DIAGNOSTICS=true` in the Worker `vars` temporarily to log safe login
diagnostics (normalized email, user found, role, active flag, hash algorithm,
iteration count and length, and verification result). Passwords, hashes,
session tokens and cookies are never logged.

### Lead demo data is missing or stale

Apply the lead migration and run the lead seed after the base seed:

```powershell
npm run db:migrate:local
npm run db:seed
npm run db:seed:leads
```

### Reset local data completely

This deletes only the local Wrangler state:

```powershell
Remove-Item -Recurse -Force .wrangler\state
npm run db:migrate:local
npm run db:seed
npm run db:seed:leads
```

### Mutations fail with `invalid_origin` on a workers.dev URL

The Origin guard only trusts the request origin and `APP_URL`. Production is
configured for `https://crm.shifranuhatech.com`. If you intentionally test through
a `*.workers.dev` URL, temporarily update `APP_URL` for that environment, or use
the custom domain.

### Remote commands require authentication

Run `npx wrangler login` and ensure the correct Cloudflare account is selected.

### Build contains `.dev.vars`

The build script removes it automatically via `scripts/clean-build.mjs`. Verify
with:

```powershell
Get-ChildItem -Recurse dist -Filter .dev.vars
```

The command should return nothing.

---

## Version 3 scope

### Implemented

- Authentication, sessions, logout, `/me`, password change, profile update
- Owner/admin/employee RBAC with server-side target protection
- Leads list, search, filters, quick filters, sorting and pagination
- Lead create/edit/archive with duplicate detection and override
- Pipeline board with maintained drag-and-drop plus accessible manual stage changes
- Lead detail with information, activity timeline and quick actions
- Contact status tracking with automatic updates and manual override
- Follow-ups: today, upcoming, overdue, completed, reschedule and cancel
- Customers list with status tabs, search, filters, sorting and pagination
- Customer create/edit/archive/restore with sequential customer numbers
- Customer detail with contacts, linked enquiries/leads, service history, notes and activity timeline
- Multiple contacts per customer with a single-primary invariant
- Team-wide duplicate detection by phone/email/business name with explicit override
- Won-lead conversion by linking an existing customer or creating one after confirmation
- Real lead and customer dashboard metrics, pipeline overview, sources, growth, recent leads/customers and conversion
- Employee list, search/filter/pagination, create, edit, activate/deactivate
- Owner-only audit log with filters, including lead and customer events
- Owner-only application settings
- Responsive layout, mobile navigation, loading/error/empty states
- Local D1 development, migrations, idempotent seed, lead/customer demo seeds, owner bootstrap
- Automated security, RBAC, lead/customer workflow, and data-integrity tests

### Explicitly coming soon

Projects, Tasks & Follow-ups (the general cross-module task module), Payments,
Documents, and Reports appear in the sidebar as disabled items. Dashboard cards
for active projects and pending payments show a clearly marked "Coming soon"
state rather than fabricated numbers. Lead and customer metrics are real.

### Deliberately out of scope for Version 3

- CRM modules listed above
- Projects, invoices, payments or document storage generated from customers
- Email delivery / password reset by email
- Multi-factor authentication
- File storage
- Multi-tenancy
- Public registration
- Automated lead/customer import or third-party integrations
- Automatic customer merging

---

## Project structure

```
src/
  client/                 React SPA
    components/           Layout, auth guards, reusable UI, lead/customer components
    hooks/                Auth, toast, debounce
    lib/                  API client, permissions, formatting, CRM dates
    pages/                Login, dashboard, leads, pipeline, lead detail,
                          follow-ups, customers, customer detail, employees,
                          audit, settings, profile
    services/             Typed API wrappers (users, leads, follow-ups, customers, ...)
  server/                 Cloudflare Worker API
    auth/                 Password hashing, sessions, cookies, RBAC
    db/                   Drizzle schema, client, lead/follow-up/customer queries
    lib/                  Errors, response, validation, phone/time/encoding
    middleware/           Auth, CSRF, security headers/origin
    routes/               Hono route modules (leads, follow-ups, customers, users, ...)
    schemas/              Zod request validation (lead/follow-up/customer schemas)
    services/             Business logic (leads, follow-ups, customers, dashboard, audit)
    app.ts                Hono app and error handling
    index.ts              Worker entry
  shared/                 Types/constants shared by client and server
                          (leads, customers, services, permissions, audit)
migrations/               D1 SQL migrations + Drizzle metadata
scripts/                  Bootstrap, base seed, lead/customer demo seeds, D1 helpers
tests/                    Vitest suites and helpers
wrangler.jsonc            Worker, assets, D1, routes, staging config
```

---

## License

Internal / proprietary — Shifra Nuha Technologies.
