# Website (www.lofipix.app) — Storyboard

Marketing + management surface. Desktop-first, always-online, thin client over
the central Hono API. React + TanStack Router / Start (static export),
shadcn/ui + Tailwind, TanStack Query, Better Auth client. No local persistence.

## User journey

`Welcome → Signup/Login → Dashboard → Album detail → Account → Billing`

A visitor learns what lofipix is, creates an organisation, then manages albums,
users, devices, and billing from the desktop. Photo capture happens in the PWA;
the website is for review and administration.

## Pages

### 1. Welcome (`/`)

Marketing page. What lofipix is, who it's for, how the PWA + cloud sync works.

- Hero: value proposition + CTA (Sign up / Open PWA).
- Feature strip: offline-first PWA capture, cloud albums, organisation sharing.
- Pricing teaser → links to Billing/Signup.
- Footer: docs, status, contact.

### 2. Signup (`/signup`)

Create user + organisation in one flow.

- Fields: organisation name, name, email, password.
- States: loading, validation error, success → Dashboard.
- Uses Better Auth client; errors surfaced inline.

### 3. Login (`/login`)

Standard email/password login.

- Fields: email, password (visibility toggle), submit.
- Error handling for invalid credentials; redirect back to originally requested page.

### 4. Dashboard (`/dashboard`)

Management and review focus. List of photo albums with thumbnails and sync state.

- **Album list**: recent albums, reverse created order, thumbnail preview + date.
- **Search**: optional filter by name (e.g. plate number) or date.
- **Sync status**: per-album indicator (local-only / queued / synced); no offline queue here — reflects server truth via TanStack Query.
- **Navigation**: settings, sync options, account info.
- Click album → Album detail.

### 5. Album detail (`/albums/:id`)

Read-only review of one album.

- Cover + metadata: name, notes (paragraphs), created/updated dates.
- Photo grid: thumbnails served via pre-signed SeaweedFS URLs.
- Actions: rename/edit notes (typed API mutation), delete (confirm → tombstone).

### 6. Account administration (`/account`)

Manage users and devices within the organisation.

- **Members**: list by role (`owner`, `admin`, `member`, `finances`), invite/remove, change role.
- **Devices**: list registered clients / API tokens, revoke.
- All checks scoped to the organisation via the Better Auth organisation plugin (see `docs/AUTHENTICATION.md`).

### 7. Billing (`/billing`)

Organisation billing (role-gated to `owner` / `finances`).

- Current plan, usage summary, invoices.
- "Connect Xero" entry point lives here or in Account; OAuth callback writes tenant mapping to account JSONB.

### 8. Settings (`/settings`)

User-level: profile, password change, sign out. Organisation-level (admins): name, defaults.

## UX notes

- Every async view has loading / error / success states; offline shows a "reconnect" banner (no local queue — website requires connectivity).
- No direct `fetch()` in components; typed API modules + TanStack Query with retry.
- Every API response validated with shared Zod schemas.
