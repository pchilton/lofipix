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
        API[Central API Hub<br>Stateless Node.js / Bun]
        DB[(PostgreSQL Database<br>Prisma ORM)]
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

```mermaid
graph TD
    ROOT["spaa (root)"] --> apps["apps/"]
    ROOT --> services["services/"]
    ROOT --> packages["packages/"]
    ROOT --> WS[["pnpm-workspace.yaml<br>Monorepo config"]]
    ROOT --> DC[["docker-compose.yml<br>Multi-container stack"]]

    apps --> web["web/<br>SolidJS + Vite Static Export"]
    apps --> mobile["mobile/"]
    mobile --> android["android/<br>React Native"]
    mobile --> ios["ios/<br>React Native"]
    mobile --> pwa["pwa/<br>SolidJS + Vite + VitePWA"]

    services --> api["api-hub/<br>JSON Stateless Controller"]

    packages --> core["core-models/<br>Zod Models & TS Types"]
    packages --> db[("database/<br>Schema + SQL Migrations")]