# Deployment

This document describes the deployment architecture and domain configuration for the application.

## Architecture

Deployed using Github actions

The API is deployed to a VPS server via SSH, while the web applications (Web App and PWA) are deployed to Cloudflare Pages.

Edge functions are served by Cloudflare Workers.

Mobile applications distributed through App Stores.

## Authentication

Authentication uses "Better Auth". Authentication is handled by the API, setting Bearer tokens in HTTP-only cookies. The cookies are scoped to ".lofipix.app".

## Domain Names

- `www.lofipix.app` - Web App (Cloudflare Pages)
- `pwa.lofipix.app` - PWA App (Cloudflare Pages)
- `edge.lofipix.app` - Edge functions (Cloudflare Worker)
- `lofipix.app` - Redirect to www (Cloudflare Worker)

## Oceania VPS

- `oceania.lofipix.app` - VPS hosting, base DNS name
- `oceania-api.lofipix.app` - API Application
- `oceania-storage.lofipix.app` - SeaweedFS
- `oceania-temporal.lofipix.app` - Temporal server

## Staging DNS

Hosted on cairngorm

- `cairngorm.lofipix.app` - Staging API
- `cairngorm-api.lofipix.app` - Staging API Application
- `cairngorm-storage.lofipix.app` - Staging SeaweedFS
- `cairngorm-temporal.lofipix.app` - Staging Temporal server
