# Go + React + PostgreSQL Production-Grade Bootstrap Scaffold

A clean, scalable, maintainable, production-ready full-stack bootstrap template with strict architectural separation between an idiomatic Go backend and a modern React/TypeScript frontend.

```text
        Browser
           │
           │ HTTPS / REST
           ▼
  ┌─────────────────┐
  │ React Frontend  │
  │ TypeScript      │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Go HTTP API     │
  │ net/http        │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ pgx + SQLC      │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ PostgreSQL      │
  └─────────────────┘
```

## 1. Project Purpose

Reusable, production-ready starting foundation for full-stack client web applications. It deliberately omits domain-specific business features (eCommerce, social feeds, user management) and provides a solid base covering:

- Strict architectural boundaries and zero cross-coupling.
- Idiomatic Go HTTP backend using standard library `net/http` and Go 1.22+ routing.
- Native PostgreSQL persistence using `pgxpool` and compile-time type-safe code generation with `sqlc`.
- Feature-driven React frontend with TypeScript, Vite, React Router, Vitest, and Testing Library.
- Production readiness: structured logging (`log/slog`), request correlation (`X-Request-ID`), health probes (`/live`, `/ready`), graceful shutdown, security headers, Docker containerization.

## 2. Technology Stack

### Frontend
| Concern | Choice |
|---|---|
| Core | React 18+, TypeScript (strict mode) |
| Build / dev | Vite |
| Routing | React Router v6+ |
| Networking | Centralized Axios client with typed envelopes |
| Lint / format | ESLint (flat config), Prettier |
| Testing | Vitest, React Testing Library |

### Backend
| Concern | Choice |
|---|---|
| Language | Go 1.23+ (compatible with stable go1.27.1) |
| Transport | `net/http` with Go 1.22+ enhanced `ServeMux` routing |
| DB driver | `github.com/jackc/pgx/v5`, `pgxpool` |
| Query layer | `sqlc` |
| Migrations | Versioned SQL (`.up.sql` / `.down.sql`) |
| Logging | `log/slog` (structured JSON) |
| Testing | `testing`, `httptest` |

### Database & Infrastructure
- PostgreSQL 16
- Docker & Docker Compose

## 3. Repository Structure

```text
project-root/
│
├── frontend/                     # Isolated React frontend application
│   ├── public/                   # Static web assets
│   ├── src/
│   │   ├── app/                  # Application root and shell
│   │   ├── assets/               # Bundled static media
│   │   ├── components/           # Generic reusable UI primitives & layout
│   │   ├── config/               # Frontend environment configuration
│   │   ├── features/             # Vertical domain slices (health, etc.)
│   │   ├── hooks/                # Reusable custom React hooks
│   │   ├── lib/                  # HTTP client and third-party library setup
│   │   ├── pages/                # Route view containers
│   │   ├── routes/               # Declarative client-side route configuration
│   │   ├── services/             # Base API client and shared network utils
│   │   ├── stores/               # Client-side state management
│   │   ├── types/                # Global frontend type definitions
│   │   ├── utils/                # Pure formatting and calculation utilities
│   │   └── main.tsx              # React entrypoint
│   ├── tests/                    # Vitest and RTL component tests
│   ├── .env.example              # Frontend environment variables template
│   ├── Dockerfile                # Multi-stage production build (Node -> Nginx)
│   ├── package.json              # Frontend dependencies and scripts
│   ├── tsconfig.json             # Strict TypeScript configuration
│   └── vite.config.ts            # Vite bundler and Vitest config
│
├── backend/                      # Isolated Go backend service
│   ├── cmd/
│   │   └── server/
│   │       └── main.go           # Application bootstrap entrypoint
│   ├── internal/                 # Internal application packages (non-exportable)
│   │   ├── config/               # Environment config loader and validator
│   │   ├── database/             # PostgreSQL pool and SQLC layer
│   │   │   ├── migrations/       # Versioned SQL migrations
│   │   │   ├── queries/          # Hand-written SQL queries for SQLC
│   │   │   ├── sqlc/             # Generated Go SQL code (DO NOT EDIT)
│   │   │   ├── pool.go           # pgxpool lifecycle and connection management
│   │   │   └── migrate.go        # Embedded SQL migration runner
│   │   ├── health/               # Health module (liveness & readiness)
│   │   │   ├── handler.go        # HTTP handlers for /live, /ready, /health
│   │   │   ├── service.go        # Health status evaluation
│   │   │   ├── types.go          # Health status types
│   │   │   └── handler_test.go   # httptest unit tests
│   │   ├── http/                 # Transport layer
│   │   │   ├── middleware/       # Correlation ID, logger, recovery, CORS, headers
│   │   │   ├── response/         # Standard JSON response envelope helpers
│   │   │   └── routes/           # Mux registration and route wiring
│   │   └── logger/               # slog initialization & context helpers
│   ├── tests/                    # Integration and helper tests
│   ├── sqlc.yaml                 # SQLC configuration
│   ├── go.mod / go.sum           # Go module files
│   ├── .env.example              # Backend environment variables template
│   ├── Dockerfile                # Multi-stage minimal production container
│   └── README.md                 # Backend-specific documentation
│
├── docs/                         # Architectural & operational manuals
│   ├── architecture.md
│   ├── development.md
│   ├── coding-standards.md
│   ├── api-conventions.md
│   ├── database.md
│   ├── security.md
│   ├── observability.md
│   └── agent-guide.md
│
├── docker-compose.yml            # Local development orchestration
├── AGENTS.md                     # Root AI agent collaboration rules
├── README.md                     # Project overview (this file)
└── .gitignore                    # Repository-level ignore rules
```

## 4. Frontend / Backend Architectural Boundaries

- **Physical boundary:** `frontend/` and `backend/` are fully isolated trees.
- **Zero code sharing:** No shared source between them. No root-level package dependencies.
- **Transport exclusivity:** Frontend talks to backend only over HTTP REST (`/api/v1/...`).
- **Data isolation:** Frontend knows nothing of SQL, PostgreSQL, pgx, or Go structs. Backend knows nothing of React, Vite, or client-side routing.

## 5. Prerequisites

- **Go** 1.23+ in `PATH`
- **Node.js** 20.x+ (LTS recommended)
- **npm** 10.x+
- **Docker & Docker Compose** for containers and PostgreSQL
- **SQLC** (optional): `go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest`

## 6. Local Setup and Quickstart

### Option A: Full stack via Docker Compose

```bash
# 1. Start all containers (PostgreSQL, Go backend, React frontend)
docker compose up -d

# 2. View logs
docker compose logs -f
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/api/v1/health

### Option B: Native local development

**Step 1 — Start PostgreSQL**

```bash
docker compose up -d postgres
```

**Step 2 — Run Go backend**

```bash
cd backend
cp .env.example .env
go mod download
go run cmd/server/main.go
```

Server starts on http://localhost:8080.

**Step 3 — Run React frontend**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend starts on http://localhost:5173.

## 7. PostgreSQL Setup, Migrations & SQLC

### Migrations

Stored in `backend/internal/database/migrations/`:

- Applied automatically on startup by an embedded Go runner.
- Plain versioned SQL, e.g. `000001_init.up.sql` / `000001_init.down.sql`.

### SQLC query generation

After editing SQL in `backend/internal/database/queries/`:

```bash
cd backend
sqlc generate
```

Generates compile-time safe Go code in `backend/internal/database/sqlc/`.

## 8. Testing and Quality Checks

### Backend

```bash
cd backend
gofmt -s -w .        # Auto-format
go vet ./...         # Static analysis
go test -v ./...     # Unit and HTTP handler tests
go test -race ./...  # Race detection
go build ./...       # Compile check
```

### Frontend

```bash
cd frontend
npm run lint         # ESLint
npm run typecheck    # TypeScript compiler check
npm run test         # Vitest unit & component tests
npm run build        # Production bundle
```

## 9. Observability & Health Probes

Operational endpoints under `/api/v1`:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health/live` | Fast liveness probe (HTTP process responsive) |
| `GET /api/v1/health/ready` | Readiness probe (pings PostgreSQL pool) |
| `GET /api/v1/health` | Aggregate health with database status and uptime |

## 10. AI-Agent Context and Rules

AI coding agents working in this repo:

- Read [AGENTS.md](AGENTS.md) and [docs/agent-guide.md](docs/agent-guide.md).
- Never import backend code into frontend or frontend code into backend.
- Never edit generated code in `backend/internal/database/sqlc/`.
- Follow the step-by-step feature workflow in `docs/agent-guide.md`.

## 11. Documentation Index

- [System Architecture](docs/architecture.md)
- [Local Development Guide](docs/development.md)
- [Coding Standards](docs/coding-standards.md)
- [API Conventions](docs/api-conventions.md)
- [Database Guide](docs/database.md)
- [Security Baseline](docs/security.md)
- [Observability & Telemetry](docs/observability.md)
- [AI Agent Guide](docs/agent-guide.md)
