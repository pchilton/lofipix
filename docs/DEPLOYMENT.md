# Deployment

This document describes the deployment architecture and domain configuration for the application.

## Architecture

Deployed using Github actions

- The API is deployed to a VPS server via SSH
- The Website is served by Cloudflare Pages
- The PWA is served by Cloudflare Pages
- Edge functions are served by Cloudflare Workers.

## Authentication

Authentication uses "Better Auth". Authentication is handled by the API, setting Bearer tokens in HTTP-only cookies. The cookies are scoped to ".lofipix.app".

## Domain Names

- `lofipix.app` - Redirect to www (Cloudflare Worker)
- `www.lofipix.app` - Web App (Cloudflare Pages)
- `pwa.lofipix.app` - PWA App (Cloudflare Pages)
- `edge.lofipix.app` - Edge functions (Cloudflare Worker)

## Oceania VPS

- `oceania.lofipix.app` - VPS hosting, base DNS name

## Staging DNS

Hosted on cairngorm

- `cairngorm.lofipix.app` - Staging API
