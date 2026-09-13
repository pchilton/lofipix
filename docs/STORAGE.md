# Storage

This document describes the setup of SeaweedFS as a S3 compatible object storage.

## Installation

SeaweedFS is deployed on VPS instances

- `oceania-storage.lofipix.app` - SeaweedFS server endpoint

## Staging

SeaweedFS is installed on cairngorm

- `cairngorm-storage.lofipix.app` - SeaweedFS server endpoint

## Authentication

Each location has a set of access keys. Image requests will be signed by the API.

## Installation

Standalone binary. Systemd service.
