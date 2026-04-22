---
title: "Task — docker-compose.yml Multi-Service Stack with Health Checks (PostgreSQL, Redis, Seq, Ollama)"
task_id: task_001
story_id: us_003
epic: EP-TECH
layer: Infrastructure
status: Not Started
date: 2026-04-20
---

# Task - task_001

## Requirement Reference
- User Story: [us_003] — GitHub Codespaces DevContainer & Full Service Stack Setup
- Story Location: `.propel/context/tasks/EP-TECH/us_003/us_003.md`
- Acceptance Criteria:
  - AC-1: All required services start automatically via `docker-compose up`: PostgreSQL 16 (port 5432/5433, pgvector extension available), a Redis-compatible cache (port 6379), Seq community server (port 5341), and Ollama (port 11434) — all within 5 minutes
  - AC-2: `docker-compose ps` shows every service container with status `healthy`; no service remains `starting` or `unhealthy` after the 5-minute provisioning window
  - Edge Case 3: `depends_on` in `docker-compose.yml` uses `condition: service_healthy` for dependent services (API waits for PostgreSQL to pass health check)
  - Edge Case 4: PostgreSQL host port mapped to `5433` for local Docker Desktop scenarios (port 5432 may be in use); `DATABASE_URL` default in `.env.example` references port `5433`

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **UI Impact** | No |
| **Figma URL** | N/A |
| **Wireframe Status** | N/A |
| **Wireframe Type** | N/A |
| **Wireframe Path/URL** | N/A |
| **Screen Spec** | N/A |
| **UXR Requirements** | N/A |
| **Design Tokens** | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Container Runtime | Docker Engine | 27.x |
| Orchestration | Docker Compose | 2.x (V2) |
| Database | PostgreSQL + pgvector | 16 + pgvector 0.7 |
| Cache | Redis-compatible (Upstash Dev) | 7.x |
| Logging UI | Seq Community Server | latest |
| AI Inference | Ollama | latest |
| AI/ML | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **AI Impact** | No |
| **AIR Requirements** | N/A |
| **AI Pattern** | N/A |
| **Prompt Template Path** | N/A |
| **Guardrails Config** | N/A |
| **Model Provider** | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| **Mobile Impact** | No |
| **Platform Target** | N/A |
| **Min OS Version** | N/A |
| **Mobile Framework** | N/A |

## Task Overview
Create the `docker-compose.yml` at the repository root that provisions the four required platform services: `postgres` (PostgreSQL 16 with pgvector extension, host port 5433), `redis` (Redis 7 compatible, port 6379), `seq` (Seq community server, port 5341), and `ollama` (Ollama inference server, port 11434). Each service must include a Docker `healthcheck` block so that `docker-compose ps` reports `healthy`. Use a `service_healthy` condition in `depends_on` for any service with an upstream dependency. Store all sensitive values in environment variables via `.env` (never hardcoded in the compose file). Persist data using named Docker volumes for PostgreSQL and Ollama models.

## Dependent Tasks
- None — this is the foundational infrastructure provisioning task for us_003.

## Impacted Components
- `/docker-compose.yml` — CREATE: multi-service compose file
- `/docker-compose.override.yml` — CREATE: local developer overrides (optional port tweaks)
- `/.env.example` — MODIFY or CREATE: add service-level env var defaults (DATABASE_URL on port 5433, REDIS_URL, SEQ_URL, OLLAMA_BASE_URL)
- `/.gitignore` — MODIFY: ensure `.env` is listed

## Implementation Plan

1. **Create `/docker-compose.yml`** at the repository root:

   ```yaml
   version: "3.9"
   
   services:
     postgres:
       image: pgvector/pgvector:pg16
       container_name: patient_access_postgres
       restart: unless-stopped
       environment:
         POSTGRES_USER: ${POSTGRES_USER:-devuser}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-devpassword}
         POSTGRES_DB: ${POSTGRES_DB:-patientaccess}
       ports:
         - "5433:5432"          # host 5433 → container 5432 (EC-4: avoids host port conflict)
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-devuser} -d ${POSTGRES_DB:-patientaccess}"]
         interval: 10s
         timeout: 5s
         retries: 10
         start_period: 30s      # allow first-time init to complete
   
     redis:
       image: redis:7-alpine
       container_name: patient_access_redis
       restart: unless-stopped
       ports:
         - "6379:6379"
       volumes:
         - redis_data:/data
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 10s
         timeout: 5s
         retries: 5
         start_period: 10s
   
     seq:
       image: datalust/seq:latest
       container_name: patient_access_seq
       restart: unless-stopped
       environment:
         ACCEPT_EULA: "Y"
       ports:
         - "5341:5341"          # ingestion
         - "8081:80"            # web UI
       volumes:
         - seq_data:/data
       healthcheck:
         test: ["CMD-SHELL", "curl -sf http://localhost/api/events?count=1 -H 'Accept: application/json' || exit 1"]
         interval: 15s
         timeout: 10s
         retries: 5
         start_period: 20s
   
     ollama:
       image: ollama/ollama:latest
       container_name: patient_access_ollama
       restart: unless-stopped
       ports:
         - "11434:11434"
       volumes:
         - ollama_data:/root/.ollama
       healthcheck:
         test: ["CMD-SHELL", "curl -sf http://localhost:11434/api/tags || exit 1"]
         interval: 15s
         timeout: 10s
         retries: 5
         start_period: 30s
   
   volumes:
     postgres_data:
     redis_data:
     seq_data:
     ollama_data:
   
   networks:
     default:
       name: patient_access_network
   ```

   Key design decisions:
   - `pgvector/pgvector:pg16` image ships PostgreSQL 16 with pgvector 0.7 pre-installed — no `CREATE EXTENSION` init script required for the extension to be available; it still needs `CREATE EXTENSION IF NOT EXISTS vector;` per-database (handled in migrations, not here).
   - Host port `5433` for PostgreSQL satisfies EC-4 (local port conflict avoidance).
   - `start_period` on PostgreSQL is 30s to allow first-time data directory initialisation before health checks begin (EC-3 scenario).
   - `seq` health check uses the Seq REST API (`/api/events`) rather than port check alone.
   - `ollama` health check uses the `/api/tags` endpoint that Ollama exposes when running.

2. **Create `/docker-compose.override.yml`** (optional local tweaks, gitignored for developer-specific adjustments):
   ```yaml
   version: "3.9"
   # Local developer overrides — do not commit secrets here
   # Uncomment and customise as needed
   services:
     postgres:
       environment:
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-devpassword}
   ```

3. **Create / update `/.env.example`** with all required development-safe defaults:
   ```env
   # Copy this file to .env and customise for your environment
   # Never commit .env to source control

   # PostgreSQL — port 5433 (host) to avoid conflict with local pg installations
   POSTGRES_USER=devuser
   POSTGRES_PASSWORD=devpassword
   POSTGRES_DB=patientaccess
   DATABASE_URL=Host=localhost;Port=5433;Database=patientaccess;Username=devuser;Password=devpassword

   # Redis
   REDIS_URL=redis://localhost:6379

   # Seq structured logging
   SEQ_URL=http://localhost:5341

   # Ollama AI inference
   OLLAMA_BASE_URL=http://localhost:11434

   # JWT — use a strong random key in production
   JWT_SIGNING_KEY=dev-only-signing-key-change-in-production-min-32chars

   # ASP.NET Core
   ASPNETCORE_ENVIRONMENT=Development
   ```

4. **Update `/.gitignore`** — ensure `.env` is listed:
   ```gitignore
   # Environment secrets — never commit
   .env
   ```
   Verify `.env.example` is NOT in `.gitignore` (it must be committed as a template).

5. **Validate service health check timing**: the total provisioning window from `docker-compose up` to all services `healthy` must be under 5 minutes (AC-1/AC-2). With `start_period` settings:
   - PostgreSQL: 30s start + up to 100s retry window = max ~130s
   - Redis: 10s start + up to 50s = max ~60s
   - Seq: 20s start + up to 75s = max ~95s
   - Ollama: 30s start + up to 75s = max ~105s
   Total worst-case parallel startup: ~130s (under the 300s / 5-minute target).

## Current Project State
```
/                       # Monorepo root
├── client/             # us_001 (React SPA)
├── api/                # us_002 (ASP.NET Core 9 API)
├── .gitignore          # Possibly exists — WILL BE MODIFIED
└── .env.example        # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/docker-compose.yml` | Multi-service compose file: postgres (pgvector/pg16, port 5433), redis (7-alpine, port 6379), seq (datalust/seq, ports 5341/8081), ollama (latest, port 11434); all with health checks and named volumes |
| CREATE | `/docker-compose.override.yml` | Optional local override skeleton (gitignored) |
| CREATE | `/.env.example` | Development-safe defaults for all env vars (DATABASE_URL, REDIS_URL, SEQ_URL, OLLAMA_BASE_URL, JWT_SIGNING_KEY) |
| MODIFY | `/.gitignore` | Add `.env` entry; confirm `.env.example` is NOT ignored |

## External References
- `pgvector/pgvector` Docker image (PostgreSQL 16 + pgvector 0.7): https://hub.docker.com/r/pgvector/pgvector
- Docker Compose `healthcheck` reference: https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck
- Docker Compose `depends_on` with `condition: service_healthy`: https://docs.docker.com/compose/compose-file/compose-file-v3/#depends_on
- Seq Docker image and ACCEPT_EULA: https://hub.docker.com/r/datalust/seq
- Ollama Docker image: https://hub.docker.com/r/ollama/ollama
- Redis 7 Alpine Docker image: https://hub.docker.com/_/redis

## Build Commands
```bash
# Start all services
docker compose up -d

# Check all containers are healthy (after ~2 minutes)
docker compose ps

# Verify PostgreSQL + pgvector
docker compose exec postgres psql -U devuser -d patientaccess -c "SELECT extname FROM pg_extension WHERE extname='vector';"

# Verify Redis
docker compose exec redis redis-cli ping

# Verify Seq (should return JSON)
curl -s http://localhost:5341/api/events?count=1

# Verify Ollama
curl -s http://localhost:11434/api/tags

# Tear down (keep volumes)
docker compose down

# Tear down + delete volumes
docker compose down -v
```

## Implementation Validation Strategy
- [ ] `docker compose up -d` starts all 4 service containers without errors
- [ ] Within 5 minutes: `docker compose ps` shows all containers with `(healthy)` status
- [ ] PostgreSQL: `docker compose exec postgres psql -U devuser -c "SELECT 1"` returns `1`
- [ ] pgvector: `docker compose exec postgres psql -U devuser -d patientaccess -c "SELECT extname FROM pg_extension WHERE extname='vector';"` returns a row (extension pre-installed in image)
- [ ] Redis: `docker compose exec redis redis-cli ping` returns `PONG`
- [ ] Seq: `curl http://localhost:5341` returns HTTP 200 (web ingestion endpoint)
- [ ] Ollama: `curl http://localhost:11434/api/tags` returns valid JSON
- [ ] `.env` is in `.gitignore`; `git status` does not show `.env` as tracked after creation

## Implementation Checklist
- [ ] Create `/docker-compose.yml` with `postgres` service (image: `pgvector/pgvector:pg16`, port `5433:5432`, health check: `pg_isready`)
- [ ] Add `redis` service to compose (image: `redis:7-alpine`, port `6379:6379`, health check: `redis-cli ping`)
- [ ] Add `seq` service to compose (image: `datalust/seq:latest`, `ACCEPT_EULA=Y`, ports `5341:5341` + `8081:80`, health check: curl `/api/events`)
- [ ] Add `ollama` service to compose (image: `ollama/ollama:latest`, port `11434:11434`, health check: curl `/api/tags`)
- [ ] Add named volumes: `postgres_data`, `redis_data`, `seq_data`, `ollama_data`
- [ ] Set `restart: unless-stopped` on all services
- [ ] Set appropriate `start_period`, `interval`, `timeout`, `retries` on each health check
- [ ] Create `/.env.example` with development-safe defaults for all required variables
- [ ] Ensure `.env` is in `/.gitignore`
- [ ] Run `docker compose up -d` and verify all services reach `healthy` within 5 minutes
