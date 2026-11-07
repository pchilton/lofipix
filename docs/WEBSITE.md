# Website (www.lofipix.app) — Storyboard

Marketing + management surface. Desktop-first, always-online, thin client over
the central Hono API. React + TanStack Router (static export), ShadCN + Tailwind
(`packages/ui`), TanStack Query, Better Auth React client. No sync engine and
no local persistence.

## User journey

`Home → Auth → Dashboard → Album detail → Account → Billing`

A visitor learns what lofipix is from the Home page and signs in or registers.
Registration creates a user and a single organisation in one flow. Photo capture
happens in the native mobile app; the website is for review and administration.

## Data source

The website treats the central API as the source of truth. It holds no local
queue and no optimistic offline state: every view reflects what the API returns
via TanStack Query. The mobile app behaves differently (PowerSync + SQLite,
device-first, optimistic updates) — see `docs/MOBILE.md`; do not carry mobile
semantics into the website.

Sync/upload status shown on the website is derived from API state, e.g.
`queued`, `processing`, `synced` — never "device-only" or "local-only", which
cannot exist here.

## Environments

The site is statically exported and selects its endpoints at runtime from
`www/src/lib/config.ts` by inspecting `window.location`:

- **Development** — port `5173` on the LAN IP only:
  `http://192.168.1.15:5173/` and `http://192.168.1.15:5634/`. `localhost` is not
  supported; loading the dev server from another hostname throws and asks for
  the LAN URL. The website and API share the `192.168.1.15` host so session
  cookies are sent.
- **Production** — HTTPS on `www.lofipix.app`: `WEBSITE_URL`
  `https://www.lofipix.app/`, `API_URL` `https://oceania.lofipix.app/`.

"No SSR": dynamic routes (`/albums/:id`, `/account`, …) rely on the host's
SPA fallback to `index.html` for client-side routing.

## Logged out users

- See the marketing **Home** (`/`) and **Auth** (`/auth`) pages.
- Cannot see the Dashboard or any management page; those redirect to `/auth`.
- The **About** page has been removed.

### Home (`/`)

Marketing page. What lofipix is, who it's for: a mobile-first, offline-first app
for capturing panel damage photos, with cloud albums and organisation sharing.

- Hero: value proposition + CTA (Sign in / Register).
- **Get the app**: the native iOS/Android app has its own login screen. Store
  links are added when the app is published; the website does not link to the
  retired PWA.
- Feature strip: offline-first capture, cloud albums, organisation sharing.
- No pricing/billing marketing until Billing is implemented.

### Auth (`/auth`)

Two-column page. Left column is the standard Better Auth email/password sign-in;
right column is the standard Better Auth registration plus organisation creation.
Columns stack on narrow screens with sign-in first.

**Left — Sign in**

- Fields: email, password (visibility toggle), submit.
- `authClient.signIn.email`; invalid-credential errors surfaced inline; loading
  state disables submit.
- On success redirect to the `redirect` search target when present
  (`/auth?redirect=/albums/123`), otherwise `/dashboard`.
- Signing in with an existing session redirects to `/dashboard`.

**Right — Create account**

- Fields: organisation name, name, email, password, confirm password (visibility
  toggle on both).
- Client-side validation: required fields and matching passwords; password
  minimum 8 characters (Better Auth default). Email-in-use errors surfaced
  inline.
- Flow: `authClient.signUp.email` creates and signs in the user, then
  `authClient.organization.create` creates the organisation. Better Auth makes
  the creator the `owner` and makes the new organisation the session's active
  organisation automatically.
- **Partial failure**: if organisation creation fails after the account is
  created, keep the user signed in and show an inline error with a **Retry create
  organisation** action (reusing the entered organisation name). The user is
  never pushed back to a state where their account exists but no recovery path is
  offered. After a reload, the Dashboard detects a signed-in user with no
  organisation and offers the same create-organisation form.
- On success redirect to `/dashboard`.

**Organisation policy**

- One organisation per user: `organizationLimit: 1` in the Better Auth
  organisation plugin (`packages/db/auth.ts`). There is no org switcher.
- All website queries are scoped to the session's active organisation.

**Email verification**

- `emailAndPassword` is enabled and sign-up is immediately active. `magicLink` /
  `emailOTP` are configured but their send callbacks are no-ops, so no
  verification email is sent and none is promised in the UI.

## Logged in users

- See Dashboard and management pages. Navigation shows account, settings and
  sign-out instead of Sign in / Register.
- Signing out clears the session and returns to `/`.
- Visiting `/auth` while signed in redirects to `/dashboard`. `/` remains the
  marketing page (reachable while signed in) with CTAs pointing at the
  authenticated app.

### Dashboard (`/dashboard`)

Management and review focus. List of photo albums with thumbnails and sync state.

- **Album list**: recent albums, reverse created order, thumbnail preview + date.
- **Notes preview**: first paragraph of the notes under the album name, when the
  album has notes; truncated with an ellipsis. Uses the shared album schema's
  normalisation (`docs/PHOTOS.md`).
- **Search**: optional filter by name (e.g. plate number) or date.
- **Status**: per-album API-derived status (queued / processing / synced).
- **Navigation**: settings, account info.
- **Click album**: Album detail.

### Album detail (`/albums/:id`)

Read-only review of one album.

- Cover + metadata: name, notes (paragraphs), created/updated dates.
- Notes are optional free text: paragraphs separated by a single blank line; line
  endings normalised to `\n`; an empty value stored as null (see `docs/PHOTOS.md`).
- Photo grid: thumbnails served via pre-signed SeaweedFS URLs.
- Actions: rename/edit notes (typed API mutation), delete (confirm → tombstone).
- Editing the notes replaces the whole value; the shared album schema normalises
  it before it is stored.

### Account administration (`/account`)

Manage users and devices within the organisation (`owner` / `admin`).

- **Members**: list by role (`owner`, `admin`, `member`, `finances`),
  invite/remove, change role.
- **Devices**: list registered clients / API tokens, revoke.
- All checks scoped to the organisation via the Better Auth organisation plugin
  (see `docs/AUTHENTICATION.md`).

### Billing (`/billing`)

Organisation billing (role-gated to `owner` / `finances`).

- Current plan, usage summary, invoices.
- "Connect Xero" entry point lives here or in Account; OAuth callback writes
  tenant mapping to account JSONB.

### Settings (`/settings`)

User-level: profile, password change, sign out. Organisation-level (admins):
name, defaults.

### Role matrix

| Route / action | owner | admin | member | finances |
| --- | --- | --- | --- | --- |
| Dashboard, albums, settings (user) | yes | yes | yes | yes |
| Album edit/delete | yes | yes | yes | no |
| Account administration | yes | yes | no | no |
| Billing | yes | no | no | yes |

## UX notes

- Every async view has loading / error / success states; offline shows a
  "reconnect" banner (no local queue — website requires connectivity).
- No direct `fetch()` in components; typed API modules + TanStack Query with retry.
- Every API response validated with shared Zod schemas.
- ShadCN components come from `@lofipix/ui`; see `docs/SHADCN.md`.
- Route guards run in TanStack Router `beforeLoad`; unauthenticated users are
  redirected to `/auth` with a `redirect` search parameter, and 404s render a
  not-found page.
