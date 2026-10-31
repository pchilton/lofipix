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
