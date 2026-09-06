# lofipix

## Architecture

```mermaid
graph TD
    %% Static Hosting
    subgraph CloudFlare [CloudFlare Pages]
        CFWeb[www.lofipix.app<br>from www/ folder]
        CFPWA[pwa.lofipix.app<br>from pwa/ folder]
    end

    %% App Stores
    subgraph AppStores [App Stores]
        GooglePlay[Google Play<br>from mobile/android/ folder]
        AppleStore[Apple Store<br>from mobile/ios/ folder]
    end

    %% Client Tier
    subgraph ClientInterfaces [Client Interfaces]
        Web[Web App<br>SolidJS / Static Export]
        PWA[PWA Web App<br>SolidJS / Static Export]
        Android[Android App<br>React Native]
        iOS[iOS App<br>React Native]
    end

    %% Network Entry
    Proxy[VPS Nginx Reverse Proxy<br>api.lofipix.app<br>SSL Termination / Port Mapping]

    %% Deployment
    GHA[GitHub Actions CI/CD] -.->|Deploys API to VPS| Proxy

    %% Core Services
    subgraph CoreBackend [Core Backend Engine]
        API[Central API Hub<br>Fastify / NodeJS]
        DB[(PostgreSQL Database<br>Drizzle ORM)]
    end

    StorageProxy[VPS Nginx Reverse Proxy<br>storage.lofipix.app<br>SSL Termination / Port Mapping]

    Storage[(MinIO Object Storage<br>Local NVMe S3)]

    %% Hosting Routes
    CFWeb -->|Serves Static Site| Web
    CFPWA -->|Serves Static Site| PWA
    GooglePlay -->|Distributes| Android
    AppleStore -->|Distributes| iOS

    %% Traffic Routes
    Web & PWA & Android & iOS -->|API Requests| Proxy
    Web & PWA & Android & iOS -->|Image Requests| StorageProxy
    Proxy -->|Local Reverse Proxy| API
    API <-->|Connection Pool| DB

    API -.->|Generate Pre-Signed URLs| Storage
    StorageProxy -->|Local Reverse Proxy| Storage

    %% Layout Classes for Styling
    style CloudFlare fill:#1e3a5f,stroke:#64748b,stroke-width:2px,color:#fff
    style AppStores fill:#312e81,stroke:#64748b,stroke-width:2px,color:#fff
    style ClientInterfaces fill:#0f3d3e,stroke:#2dd4bf,stroke-width:2px,color:#fff
    style CoreBackend fill:#3b1f2b,stroke:#fb7185,stroke-width:2px,color:#fff
    style Proxy fill:#334155,stroke:#64748b,stroke-width:2px,color:#fff
    style StorageProxy fill:#334155,stroke:#64748b,stroke-width:2px,color:#fff
    style Storage fill:#1c1917,stroke:#78716c,stroke-width:2px,color:#fff
    style GHA fill:#111827,stroke:#6b7280,stroke-width:2px,color:#fff
```

## Directory structure

| Path | Description | Technology |
| --- | --- | --- |
| `api/` | Central API | Fastify + NodeJS + Drizzle ORM |
| `config/` | Application configuration | .conf, .toml, .env, TypeScript |
| `database/` | Database schema + SQL migrations | TypeScript + Drizzle ORM |
| `mobile/android/` | Android app | React Native |
| `mobile/ios/` | iOS app | React Native |
| `models/` | Shared Zod models & TypeScript types | TypeScript |
| `pwa/` | Progressive Web Application | SolidJS + Vite + VitePWA |
| `scripts/` | Shell commands, development tasks | Bash + TypeScript |
| `www/` | Web app | SolidJS + Vite, static export |

## General technologies

- **Frontend**: SolidJS, React Native, Tailwind CSS
- **Backend**: Node.js, Fastify, Drizzle ORM
- **Shared**: TypeScript, Zod, Shared Models
- **Database**: PostgreSQL
- **Storage**: MinIO (S3-compatible)
- **Infrastructure**: Docker, Docker Compose, Nginx
- **Deployment**: VPS, GitHub Actions
