# Deployment

This document describes the deployment architecture and domain configuration for the application.

## Architecture

Deployed using Github actions

- The API is deployed to a VPS server via SSH
- The Website is served by Cloudflare Pages
- The PWA is served by Cloudflare Pages
- Edge functions are served by Cloudflare Workers.

There is no staging environment. Development (cholet) and production (oceania) only.

## Authentication

Authentication uses "Better Auth". Authentication is handled by the API, setting Bearer tokens in HTTP-only cookies. The cookies are scoped to ".lofipix.app".

## Domain Names

- `lofipix.app` - Redirect to www (Cloudflare Worker)
- `www.lofipix.app` - Web App (Cloudflare Pages)
- `pwa.lofipix.app` - PWA App (Cloudflare Pages)
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
