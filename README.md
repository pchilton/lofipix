# lofipix

## Architecture

```mermaid
graph TD
    %% Client Tier
    subgraph ClientInterfaces [Client Interfaces]
        Web[Web App<br>SolidJS / Static Export]
        PWA[PWA Web App<br>SolidJS / Static Export]
        Android[Android App<br>React Native]
        iOS[iOS App<br>React Native]
    end

    %% Network Entry
    Proxy[VPS Nginx Reverse Proxy<br>SSL Termination / Port Mapping]

    %% Core Services
    subgraph CoreBackend [Core Backend Engine]
        API[Central API Hub<br>Fastify / NodeJS]
        DB[(PostgreSQL Database<br>Drizzle ORM)]
    end

    Storage[(MinIO Object Storage<br>Local NVMe S3)]

    %% Traffic Routes
    Web & PWA & Android & iOS -->|HTTPS / API Requests| Proxy
    Proxy -->|Local Reverse Proxy| API
    API <-->|Connection Pool| DB

    API -.->|Generate Pre-Signed URLs| Storage

    %% Layout Classes for Styling
    style Proxy fill:#334155,stroke:#64748b,stroke-width:2px,color:#fff
    style Storage fill:#1c1917,stroke:#78716c,stroke-width:2px,color:#fff
```

## Directory structure

| Path | Description | Technology |
| --- | --- | --- |
| `web/` | Web app | SolidJS + Vite, static export |
| `mobile/android/` | Android app | React Native |
| `mobile/ios/` | iOS app | React Native |
| `mobile/pwa/` | PWA | SolidJS + Vite + VitePWA |
| `api/` | Central API | Fastify + NodeJS + Drizzle ORM |
| `models/` | Shared Zod models & TypeScript types | TypeScript |
| `database/` | Database schema + SQL migrations | TypeScript + Drizzle ORM |
| `scripts/` | Shell commands, development tasks | Bash + TypeScript |
| `config/` | Application configuration | .conf, .toml, .env, TypeScript |

## General technologies

- **Frontend**: SolidJS, React Native, Tailwind CSS
- **Backend**: Node.js, Fastify, Drizzle ORM
- **Shared**: TypeScript, Zod, Shared Models
- **Database**: PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Infrastructure**: Docker, Docker Compose, Nginx
- **Deployment**: VPS, GitHub Actions
