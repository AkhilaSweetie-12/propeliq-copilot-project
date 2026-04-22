---
title: "Task — devcontainer.json, Post-Create Script (Ollama Model Pull + Retry), Port Forwarding & .env Bootstrap"
task_id: task_002
story_id: us_003
epic: EP-TECH
layer: Infrastructure
status: Not Started
date: 2026-04-20
---

# Task - task_002

## Requirement Reference
- User Story: [us_003] — GitHub Codespaces DevContainer & Full Service Stack Setup
- Story Location: `.propel/context/tasks/EP-TECH/us_003/us_003.md`
- Acceptance Criteria:
  - AC-3: `dotnet run` (port 5000) and `npm run dev` (port 3000) ports are automatically forwarded by Codespaces and accessible in the browser; Codespaces ports panel shows both
  - AC-4: `post-create` command: `ollama pull llama3.2:3b-instruct-q8_0` and `ollama pull nomic-embed-text` complete successfully; `curl http://localhost:11434/api/tags` returns JSON listing both model names
  - AC-6: `.env.example` at repository root pre-populated with development-safe defaults; `.env` is listed in `.gitignore` and never committed
  - Edge Case 1: `ollama pull` failure due to network timeout → retry loop (max 3 attempts, 10-second delay) with stdout logging; devcontainer completes startup regardless with a warning message
  - Edge Case 2: `devcontainer.json` specifies `"hostRequirements": { "memory": "16gb" }` to warn users when the Codespaces machine is under-resourced

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
| Container Config | devcontainer.json | VS Code Dev Containers spec |
| Container Runtime | Docker Engine | 27.x |
| Base Image | mcr.microsoft.com/devcontainers/base | ubuntu-24.04 |
| .NET SDK | .NET SDK | 9.0 LTS |
| Node.js | Node.js | 20 LTS |
| AI Inference | Ollama | latest |
| Shell | bash | 5.x |
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
Create the `.devcontainer/devcontainer.json` configuration that references the `docker-compose.yml` from task_001 as the compose file, specifying the correct service, port forwards (3000, 5000, 5341, 5432, 6379, 11434), and VS Code extensions. Set `"hostRequirements": { "memory": "16gb" }` for EC-2. Create the `post-create` shell script that copies `.env.example` → `.env` if `.env` does not exist, installs .NET and Node dependencies, and pulls the two Ollama models inside a retry-loop function (max 3 attempts, 10-second sleep between attempts). The `.env.example` created in task_001 is consumed here; this task adds the `postCreateCommand` and script wiring.

## Dependent Tasks
- `task_001_infra_docker_compose_services.md` — `docker-compose.yml` and `.env.example` must exist before `devcontainer.json` can reference them.

## Impacted Components
- `/.devcontainer/devcontainer.json` — CREATE: devcontainer configuration referencing docker-compose, port forwards, extensions, hostRequirements
- `/.devcontainer/post-create.sh` — CREATE: shell script for bootstrapping (env file, deps install, Ollama pull with retry)
- `/.devcontainer/on-create.sh` — CREATE: lightweight pre-setup script (verify tools available, copy .env.example if missing)

## Implementation Plan

1. **Create `/.devcontainer/devcontainer.json`**:
   ```jsonc
   {
     "name": "Patient Access Platform",
     "dockerComposeFile": "../docker-compose.yml",
     "service": "api",                        // devcontainer runs inside the api service container
     "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
     "hostRequirements": {
       "memory": "16gb"                       // EC-2: warns if Codespaces machine < 16GB
     },
     "forwardPorts": [
       3000,    // React SPA (npm run dev)
       5000,    // ASP.NET Core API (dotnet run)
       5341,    // Seq log ingestion
       8081,    // Seq web UI
       5433,    // PostgreSQL (host port)
       6379,    // Redis
       11434    // Ollama inference
     ],
     "portsAttributes": {
       "3000": { "label": "React SPA", "onAutoForward": "openBrowser" },
       "5000": { "label": "ASP.NET Core API", "onAutoForward": "notify" },
       "5341": { "label": "Seq Ingestion", "onAutoForward": "silent" },
       "8081": { "label": "Seq UI", "onAutoForward": "notify" },
       "11434": { "label": "Ollama", "onAutoForward": "silent" }
     },
     "onCreateCommand": "bash .devcontainer/on-create.sh",
     "postCreateCommand": "bash .devcontainer/post-create.sh",
     "customizations": {
       "vscode": {
         "extensions": [
           "ms-dotnettools.csdevkit",
           "ms-dotnettools.csharp",
           "esbenp.prettier-vscode",
           "dbaeumer.vscode-eslint",
           "bradlc.vscode-tailwindcss",
           "ms-azuretools.vscode-docker",
           "datalust.seq-vscode"
         ],
         "settings": {
           "dotnet.defaultSolution": "api/Api.csproj",
           "editor.formatOnSave": true,
           "editor.defaultFormatter": "esbenp.prettier-vscode",
           "[csharp]": { "editor.defaultFormatter": "ms-dotnettools.csdevkit" }
         }
       }
     }
   }
   ```

   **Design note on `"service": "api"`**: The devcontainer spec supports `dockerComposeFile` + `service` to attach the IDE into one container while keeping all compose services running. Because the `/api` container may not exist yet (it is built separately), an alternative is to use `"image"` with a standalone devcontainer and invoke `docker compose up` in `postCreateCommand`. The recommended pattern for this monorepo is to keep `devcontainer.json` as a standalone devcontainer (using a base Ubuntu image with .NET + Node feature packs) and `docker-compose.yml` for the services only — see Step 2.

2. **Revised `devcontainer.json`** (standalone approach — avoids coupling devcontainer lifecycle to API build):
   ```jsonc
   {
     "name": "Patient Access Platform",
     "image": "mcr.microsoft.com/devcontainers/base:ubuntu-24.04",
     "features": {
       "ghcr.io/devcontainers/features/dotnet:2": { "version": "9.0" },
       "ghcr.io/devcontainers/features/node:1": { "version": "20" },
       "ghcr.io/devcontainers/features/docker-in-docker:2": {}
     },
     "hostRequirements": {
       "memory": "16gb"
     },
     "forwardPorts": [3000, 5000, 5341, 8081, 5433, 6379, 11434],
     "portsAttributes": {
       "3000": { "label": "React SPA", "onAutoForward": "openBrowser" },
       "5000": { "label": "ASP.NET Core API", "onAutoForward": "notify" },
       "8081": { "label": "Seq UI", "onAutoForward": "notify" }
     },
     "onCreateCommand": "bash .devcontainer/on-create.sh",
     "postCreateCommand": "bash .devcontainer/post-create.sh",
     "customizations": {
       "vscode": {
         "extensions": [
           "ms-dotnettools.csdevkit",
           "ms-dotnettools.csharp",
           "esbenp.prettier-vscode",
           "dbaeumer.vscode-eslint",
           "bradlc.vscode-tailwindcss",
           "ms-azuretools.vscode-docker",
           "datalust.seq-vscode"
         ],
         "settings": {
           "dotnet.defaultSolution": "api/Api.csproj",
           "editor.formatOnSave": true,
           "[csharp]": { "editor.defaultFormatter": "ms-dotnettools.csdevkit" }
         }
       }
     }
   }
   ```

3. **Create `/.devcontainer/on-create.sh`** — runs at container creation (before post-create):
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   
   echo "[on-create] Starting pre-setup..."
   
   # Copy .env.example to .env if .env does not already exist (AC-6)
   if [ ! -f .env ]; then
     cp .env.example .env
     echo "[on-create] .env created from .env.example"
   else
     echo "[on-create] .env already exists — skipping copy"
   fi
   
   echo "[on-create] Pre-setup complete."
   ```

4. **Create `/.devcontainer/post-create.sh`** — runs after container creation:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   
   echo "[post-create] Starting full environment bootstrap..."
   
   # ── Start Docker Compose services ─────────────────────────────────────────────
   echo "[post-create] Starting compose services..."
   docker compose up -d
   echo "[post-create] Waiting for services to become healthy..."
   # Wait up to 5 minutes for all services to pass health checks
   TIMEOUT=300
   ELAPSED=0
   until docker compose ps | grep -qv "starting\|unhealthy" && \
         docker compose ps | grep -q "healthy"; do
     if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
       echo "[post-create] WARNING: services did not all reach healthy within ${TIMEOUT}s"
       break
     fi
     sleep 10
     ELAPSED=$((ELAPSED + 10))
   done
   
   # ── Install .NET dependencies ──────────────────────────────────────────────────
   echo "[post-create] Restoring .NET packages..."
   cd /workspaces/"${CODESPACE_REPOSITORY_NAME:-$(basename "$PWD")}"/api
   dotnet restore
   cd ..
   
   # ── Install Node.js dependencies ───────────────────────────────────────────────
   echo "[post-create] Installing Node packages..."
   cd client
   npm ci
   cd ..
   
   # ── Pull Ollama models with retry (EC-1) ────────────────────────────────────────
   pull_model_with_retry() {
     local model="$1"
     local max_attempts=3
     local delay=10
     local attempt=1
   
     while [ "$attempt" -le "$max_attempts" ]; do
       echo "[post-create] Pulling Ollama model: ${model} (attempt ${attempt}/${max_attempts})..."
       if curl -s -X POST http://localhost:11434/api/pull \
            -H 'Content-Type: application/json' \
            -d "{\"name\":\"${model}\"}" | grep -q '"status":"success"'; then
         echo "[post-create] Successfully pulled: ${model}"
         return 0
       else
         echo "[post-create] WARNING: Failed to pull ${model} (attempt ${attempt}/${max_attempts})"
         if [ "$attempt" -lt "$max_attempts" ]; then
           echo "[post-create] Retrying in ${delay}s..."
           sleep "$delay"
         fi
       fi
       attempt=$((attempt + 1))
     done
   
     echo "[post-create] WARNING: Could not pull ${model} after ${max_attempts} attempts. Continuing without it."
     echo "[post-create] To pull manually: curl -X POST http://localhost:11434/api/pull -d '{\"name\":\"${model}\"}'"
     return 0   # non-fatal: devcontainer must complete startup regardless (EC-1)
   }
   
   pull_model_with_retry "llama3.2:3b-instruct-q8_0"
   pull_model_with_retry "nomic-embed-text"
   
   # ── Verify Ollama models are available (AC-4) ──────────────────────────────────
   echo "[post-create] Verifying Ollama model availability..."
   TAGS=$(curl -sf http://localhost:11434/api/tags 2>/dev/null || echo '{}')
   echo "[post-create] Available models: ${TAGS}"
   
   echo "[post-create] Bootstrap complete. Happy coding!"
   ```

   Key decisions:
   - `set -euo pipefail` — strict mode, but `pull_model_with_retry` always returns 0 so the container is never aborted due to model download failures (EC-1).
   - `npm ci` (not `npm install`) — ensures reproducible installs from `package-lock.json`.
   - Ollama pull uses the REST API (`/api/pull`) via `curl` rather than the CLI to avoid requiring the `ollama` CLI binary in the devcontainer image.

5. **Confirm `.gitignore`** additions from task_001 are present and extend with devcontainer-generated files:
   ```gitignore
   .env
   .devcontainer/on-create.log
   .devcontainer/post-create.log
   ```

## Current Project State
```
/
├── docker-compose.yml          # task_001 (postgres, redis, seq, ollama)
├── .env.example                # task_001 (development-safe defaults)
├── .gitignore                  # task_001 (includes .env)
├── client/                     # us_001
├── api/                        # us_002
└── .devcontainer/              # NOT YET CREATED — created by this task
```

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | `/.devcontainer/devcontainer.json` | Standalone devcontainer: Ubuntu 24.04 base + .NET 9 + Node 20 features + `docker-in-docker`; port forwards 3000/5000/5341/8081/5433/6379/11434; `hostRequirements.memory=16gb`; VS Code extensions |
| CREATE | `/.devcontainer/on-create.sh` | Pre-create: copies `.env.example` → `.env` if `.env` absent |
| CREATE | `/.devcontainer/post-create.sh` | Full bootstrap: compose up + health wait + `dotnet restore` + `npm ci` + Ollama model pull with retry loop |
| MODIFY | `/.gitignore` | Add `.devcontainer/*.log` entries (if not present) |

## External References
- devcontainer.json specification — `hostRequirements`: https://containers.dev/implementors/json_reference/#hostRequirements
- devcontainer Features — dotnet: https://github.com/devcontainers/features/tree/main/src/dotnet
- devcontainer Features — node: https://github.com/devcontainers/features/tree/main/src/node
- devcontainer Features — docker-in-docker: https://github.com/devcontainers/features/tree/main/src/docker-in-docker
- Ollama REST API — `/api/pull`: https://github.com/ollama/ollama/blob/main/docs/api.md#pull-a-model
- Ollama REST API — `/api/tags`: https://github.com/ollama/ollama/blob/main/docs/api.md#list-local-models
- GitHub Codespaces port forwarding — `portsAttributes`: https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers#port-forwarding

## Build Commands
```bash
# Validate devcontainer.json schema (VS Code Dev Containers CLI)
npx @devcontainers/cli validate --workspace-folder .

# Manually test post-create.sh locally
bash .devcontainer/post-create.sh

# Verify Ollama models after post-create
curl -s http://localhost:11434/api/tags | python3 -m json.tool

# Verify both models are present
curl -s http://localhost:11434/api/tags | grep -E "llama3.2|nomic-embed-text"
```

## Implementation Validation Strategy
- [ ] Opening the repository in GitHub Codespaces triggers devcontainer build; within 5 minutes all 4 compose services show `healthy` in `docker compose ps`
- [ ] After `post-create.sh` completes: `curl http://localhost:11434/api/tags` returns JSON with `llama3.2:3b-instruct-q8_0` and `nomic-embed-text` listed
- [ ] Simulating a network failure during `ollama pull`: script retries 3 times with 10s delay and then continues without crashing (logs "WARNING: Could not pull..."); devcontainer reaches healthy state
- [ ] Codespaces ports panel lists ports 3000 and 5000 after `npm run dev` and `dotnet run` are started
- [ ] `.env` is created from `.env.example` automatically by `on-create.sh`; `git status` shows `.env` as untracked (not staged)
- [ ] `devcontainer.json` with `hostRequirements.memory=16gb` causes Codespaces UI to warn when a machine below 16GB is selected

## Implementation Checklist
- [ ] Create `/.devcontainer/devcontainer.json` with `image: mcr.microsoft.com/devcontainers/base:ubuntu-24.04`
- [ ] Add `features`: `dotnet@2` (v9.0), `node@1` (v20), `docker-in-docker@2`
- [ ] Set `"hostRequirements": { "memory": "16gb" }` (EC-2)
- [ ] Add `forwardPorts: [3000, 5000, 5341, 8081, 5433, 6379, 11434]`
- [ ] Configure `portsAttributes`: label and `onAutoForward` for ports 3000 (openBrowser), 5000 (notify), 8081 (notify)
- [ ] Set `onCreateCommand: "bash .devcontainer/on-create.sh"` and `postCreateCommand: "bash .devcontainer/post-create.sh"`
- [ ] Add VS Code extensions list (csdevkit, csharp, prettier, eslint, tailwindcss, docker, seq)
- [ ] Create `/.devcontainer/on-create.sh`: copy `.env.example` → `.env` if `.env` absent
- [ ] Create `/.devcontainer/post-create.sh`: `docker compose up -d`, health wait loop, `dotnet restore`, `npm ci`, `pull_model_with_retry` function
- [ ] Implement `pull_model_with_retry` in post-create.sh: max 3 attempts, 10s delay, non-fatal failure (EC-1)
- [ ] Verify `post-create.sh` ends with `set -euo pipefail` safety but pull failures are non-fatal (return 0)
