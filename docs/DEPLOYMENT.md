# Deployment

This document describes the deployment architecture and domain configuration for the application.

## Architecture

Deployed using Github actions

- The API is deployed to a VPS server via SSH
- The Website is served by Cloudflare Workers (static assets)
- The PWA is served by Cloudflare Workers (static assets)
- Edge functions are served by Cloudflare Workers.

There is no staging environment. Development (cholet) and production (oceania) only.

## Static hosting and SPA fallback

The website and PWA are static Vite builds deployed as Cloudflare Workers
static assets by `cloudflare/wrangler-action`. Client-side routes must fall
back to `index.html`:

- `www/wrangler.jsonc` sets `assets.not_found_handling` to
  `"single-page-application"`, so a request such as `/auth` serves
  `dist/index.html` with status 200 and the SolidJS router handles it.
- `deploy-www.yml` runs `wrangler deploy`, which reads that config (name, asset
  directory, fallback).
- `pwa/wrangler.jsonc` sets the same fallback for the PWA, and
  `deploy-pwa.yml` runs `wrangler deploy` against that config.

## Authentication

Authentication uses "Better Auth". Authentication is handled by the API, setting Bearer tokens in HTTP-only cookies. In production the cookies are scoped to `.lofipix.app` (cross-subdomain); in development they are host-only on `192.168.1.15`. Development is accessed via the LAN IP, never localhost.

## Domain Names

- `lofipix.app` - Redirect to www (Cloudflare Worker)
- `www.lofipix.app` - Web App (Cloudflare Workers)
- `pwa.lofipix.app` - PWA App (Cloudflare Workers)
- `edge.lofipix.app` - Edge functions (Cloudflare Worker)

## Production VPS

There is a single production instance called "oceania".

- `oceania.lofipix.app` - Primary API

Locations to service via nginx reverse proxy:

- `/storage-oceania-lofipix/` - SeaweedFS S3 API, using path-based bucket routing
- `/api/` - Standard API queries via Hono
- `/powersync/` - Real-time data sync via PowerSync

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
generates a self-contained Drizzle schema (`schema.js`) and a matching
`drizzle.config.js` in `/var/www/oceania.lofipix.app/packages/db`, which
`reset-database.ts` points at when it runs `bunx drizzle-kit push`.

Run scripts from the deployed folder, selecting the region so `@lofipix/env`
finds `/var/www/oceania.lofipix.app/.env.oceania` in the parent directory:

```sh
cd /var/www/oceania.lofipix.app/scripts
REGION=oceania bun run reset-database.ts
REGION=oceania bun run powersync.ts
```

Adding a new `scripts/*.ts` file is enough; the workflow bundles and deploys it
on the next push. `reset-database.ts` needs package-download access on the VPS
for `bunx drizzle-kit push`; Bun caches it after the first run.

## Development

Hosted on cholet

- `192.168.1.15` - Development API

Locations to services by locally running processes, with HMR

- `192.168.1.15:8333/storage-cholet-lofipix/` - SeaweedFS S3 API, using path-based bucket routing
- `192.168.1.15:5634/api/` - API queries via Hono and HMR
- `192.168.1.15:5173/` - WWW on local port and HMR
- `192.168.1.15:5174/` - PWA on local port and HMR
- `192.168.1.15:5635/` - PowerSync on local port

Development commands (per app, with `REGION=cholet`):

- API: `REGION=cholet bun run --hot src/index.ts` (from `api/`)
- WWW: `REGION=cholet bun run dev` (from `www/`)
- PWA: `REGION=cholet bun run dev` (from `pwa/`)
