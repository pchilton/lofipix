# Storage

This document describes the setup of SeaweedFS as a S3 compatible object storage.

## Installation

SeaweedFS is deployed on VPS instances. There is a bucket name and nginx proxies direct to the bucket.

- bucket name: storage-oceania-lofipix
- API: `oceania.lofipix.app`
- URL: `https://oceania.lofipix.app/storage-oceania-lofipix/`

## Development

SeaweedFS is installed on cholet

- bucket name: storage-cholet-lofipix
- API: `192.168.1.15`
- URL: `http://192.168.1.15:8333/storage-cholet-lofipix/`

## Authentication

Each location has a set of access keys.
Image requests will be signed by the API.

## Installation

Standalone binary. Systemd service.

## Initial setup

Open an admin shell: weed shell -master=localhost:9333
Run inside the shell: s3.bucket.create -name=storage-oceania-lofipix

Create an authentication file

```json
{
  "identities": [
    {
      "name": "admin-user",
      "credentials": [
        {
          "accessKey": "<ACCESS_KEY>",
          "secretKey": "<SECRET_KEY>"
        }
      ],
      "actions": ["Read", "Write", "List", "Tagging"]
    }
  ]
}
```

## Systemd service

This runs as a single process, configuring the admin credentials.

```conf
[Unit]
Description=SeaweedFS Monolithic Server (Master, Volume, Filer, S3)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=seaweedfs
Group=seaweedfs

# Flag breakdown:
# -dir: The location where metadata, volumes, and temporary blocks are saved
# -s3: Enables the built-in S3-compatible API gateway
# -s3.port: The network port dedicated to S3 object storage transactions
# -s3.config: Absolute path mapping out your IAM users and access keys
ExecStart=/usr/local/bin/weed server \
    -dir=/data/seaweedfs \
    -master.port=8500 \
    -volume.port=8501 \
    -filer.port=8502 \
    -s3 \
    -s3.port=8333 \
    -s3.config=/etc/seaweedfs/s3.json

Restart=on-failure
RestartSec=5s

# Hardening / Sandboxing protections
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```
