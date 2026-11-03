# Deployment

This document describes the deployment architecture and domain configuration for the application.

## Architecture

Deployed using Github actions

- The API is deployed to a VPS server via SSH
- The Website is served by Cloudflare Workers (static assets)
- The mobile app is distributed to the iOS App Store and Google Play (not implemented in this task)
- Edge functions are served by Cloudflare Workers.

There is no staging environment. Development (cholet) and production (oceania) only.

## Static hosting and SPA fallback

The website is a static Vite build deployed as Cloudflare Workers static assets
by `cloudflare/wrangler-action`. Client-side routes must fall back to
`index.html`:

- `www/wrangler.jsonc` sets `assets.not_found_handling` to
  `"single-page-application"`, so a request such as `/auth` serves
  `dist/index.html` with status 200 and the React router handles it.
- `deploy-www.yml` runs `wrangler deploy`, which reads that config (name, asset
  directory, fallback).

There is no PWA deployment: `pwa.lofipix.app` is retired when the native app
replaces the PWA.

## Authentication

Authentication uses "Better Auth". The website uses HTTP-only cookie sessions issued by the API; in production the cookies are scoped to `.lofipix.app` (cross-subdomain), and in development they are host-only on `192.168.1.15`. The mobile app uses the Better Auth bearer plugin and stores its token in the device keychain. Development is accessed via the LAN IP, never localhost.

## Domain Names

- `lofipix.app` - Redirect to www (Cloudflare Worker)
- `www.lofipix.app` - Web App (Cloudflare Workers)
- `edge.lofipix.app` - Edge functions (Cloudflare Worker)

`pwa.lofipix.app` is retired; the native app does not use a web domain.

## Production VPS

There is a single production instance called "oceania".

- `oceania.lofipix.app` - Primary API

Locations to service via nginx reverse proxy:

- `/storage-oceania-lofipix/` - SeaweedFS S3 API, using path-based bucket routing
- `/api/` - Standard API queries via Hono
- `/api/sync/shapes/` - ElectricSQL shape streams (proxied by the API; Electric itself is loopback-only)

## API deployment (oceania)

`.github/workflows/deploy-api.yml` deploys the API on pushes to `main` that touch
`api/`, `packages/`, the root `bun.lock` or `package.json`, or the workflow
itself. It can also be run manually with `workflow_dispatch`.

The job installs the workspace at the repo root, typechecks and builds `api/`,
then copies only the built `api/dist/index.js` to
`/var/www/oceania.lofipix.app/index.js` over SSH as `ubuntu`, using the
`DEPLOY_PRIVATE_KEY` secret. The output is a platform-independent JavaScript
bundle (CI runs on amd64, oceania is ARM64), so no native build is required on
the server. The previous bundle is kept as `index.js.previous` for manual
rollback.

After uploading, the job restarts the service with
`sudo systemctl restart lofipix-api` and polls
`http://127.0.0.1:5634/health` up to 15 times; it fails if the API does not
report `{"status":"ok"}`.

### One-time VPS setup

Prerequisites: Bun installed for `ubuntu` (the unit below uses
`/home/ubuntu/.bun/bin/bun`), `rsync`, `curl`, and nginx proxying `/api/` to
`127.0.0.1:5634` (see `docs/NGINX.md`).

1. Create the deploy folder and give it to the deploy user:

   ```sh
   sudo mkdir -p /var/www/oceania.lofipix.app
   sudo chown ubuntu:ubuntu /var/www/oceania.lofipix.app
   ```

2. Put the production environment in
   `/var/www/oceania.lofipix.app/.env.oceania` (keys are listed in
   `.env.example`). The workflow verifies the file exists but never overwrites
   it. `REGION=oceania` makes `@lofipix/env` load this file from the service's
   working directory.

3. Install `/etc/systemd/system/lofipix-api.service`:

   ```ini
   [Unit]
   Description=lofipix API (oceania)
   After=network.target

   [Service]
   Type=simple
   User=ubuntu
   Group=ubuntu
   WorkingDirectory=/var/www/oceania.lofipix.app
   Environment=REGION=oceania
   Environment=PORT=5634
   ExecStart=/home/ubuntu/.bun/bin/bun /var/www/oceania.lofipix.app/index.js
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now lofipix-api
   ```

4. Let the deploy user restart only this unit without a password. Create
   `/etc/sudoers.d/lofipix-deploy` with `sudo visudo -f /etc/sudoers.d/lofipix-deploy`:

   ```sudoers
   ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart lofipix-api
   ```

Before the first deploy, `/var/www/oceania.lofipix.app/index.js` does not
exist; the job's health check fails until the unit and `.env.oceania` are in
place.

## Scripts deployment (oceania)

`.github/workflows/deploy-scripts.yml` deploys the ad-hoc administration
scripts on pushes to `main` that touch `scripts/`, `packages/`, the root
`bun.lock` or `package.json`, or the workflow itself. It can also be run
manually with `workflow_dispatch`.

CI bundles every top-level `scripts/*.ts` with `bun build --target bun` and
ships the bundles to `/var/www/oceania.lofipix.app/scripts` under their
original `.ts` names, so the VPS does not need `node_modules` for them. It also
generates a self-contained Drizzle schema (`schema.js`), a matching
`drizzle.config.js`, and an ARM64 `node_modules` containing `drizzle-kit`,
`drizzle-orm` and `pg` in `/var/www/oceania.lofipix.app/packages/db`.
`reset-database.ts` runs that local `drizzle-kit` binary, so the VPS does not
need package downloads to push the schema.

Run scripts from the deployed folder, selecting the region so `@lofipix/env`
finds `/var/www/oceania.lofipix.app/.env.oceania` in the parent directory:

```sh
cd /var/www/oceania.lofipix.app/scripts
REGION=oceania bun run reset-database.ts
REGION=oceania bun run electric.ts
```

Adding a new `scripts/*.ts` file is enough; the workflow bundles and deploys it
on the next push.

## Mobile app deployment (iOS and Android)

The mobile app is built with bare React Native. Two store pipelines are
available; neither is implemented in the migration task.

- **EAS Build/Submit** — Expo Application Services can build bare React Native
  projects without adopting the Expo runtime. `eas build --platform all` and
  `eas submit` would use the `app.lofipix.mobile` identifiers and the Apple/Google
  credentials configured in the EAS project.
- **Fastlane in GitHub Actions** — build with Gradle (Android) and Xcode
  (iOS, needs a macOS runner), sign with the Apple/Google credentials held as
  GitHub secrets, and upload with Fastlane. This keeps deployment inside the
  existing GitHub Actions pattern.

Requirements before either pipeline can run:

- Apple Developer and Google Play developer accounts.
- An iOS distribution certificate/provisioning profile and an Android upload
  key.
- Store listing metadata, privacy disclosures and screenshots.
- App identifiers `app.lofipix.mobile` (already planned) and a versioning policy.

No store credentials, signing keys or publishing workflows are committed to this
repository.

## Development

Hosted on cholet

- `192.168.1.15` - Development API

Locations to services by locally running processes, with HMR

- `192.168.1.15:8333/storage-cholet-lofipix/` - SeaweedFS S3 API, using path-based bucket routing
- `192.168.1.15:5634/api/` - API queries via Hono and HMR
- `192.168.1.15:5173/` - WWW on local port and HMR
- `127.0.0.1:5637/` - ElectricSQL on local port (loopback only)
- Mobile: native development build connecting to `http://192.168.1.15:5634/` (Android emulators may use `10.0.2.2`)

Development commands (per app, with `REGION=cholet`):

- API: `REGION=cholet bun run --hot src/index.ts` (from `api/`)
- WWW: `REGION=cholet bun run dev` (from `www/`)
- Mobile: `bun run android` or `bun run ios` from `mobile/` once prompt 0026 lands
