# Quick Start Guide

Get PropelIQ-Copilot running locally in 5 minutes.

---

## 1. Local Development (No GCP Required)

### Start Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify
docker-compose ps

# Expected output:
# propeliq-postgres   Up   5432/tcp
# propeliq-redis      Up   6379/tcp
```

### Stop Services

```bash
docker-compose down

# Include volume cleanup
docker-compose down -v
```

### Access Services

```bash
# PostgreSQL
psql -h localhost -U propeliq_user -d propeliq_dev

# Redis
redis-cli -h localhost -p 6379

# View logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 2. GitHub Actions Workflows (Local Testing)

### Prerequisites

```bash
# Install act (GitHub Actions local runner)
# macOS
brew install act

# Windows/Ubuntu
# Download from: https://github.com/nektos/act/releases
```

### Run CI Workflow

```bash
# Test detection (no build needed)
act pull_request --job detect-stack

# Run all CI checks
act pull_request

# View specific job
act --list

# Run single job
act --job api-tests
```

---

## 3. Cloud Deployment (Requires GCP Setup)

### Prerequisites

- [ ] Follow [GCP_SETUP.md](GCP_SETUP.md) to configure GCP and GitHub secrets
- [ ] Verify Terraform configuration is valid

### Deploy to GCP

1. **Go to GitHub Actions**
   ```
   Repository → Actions → GCP Terraform Deploy
   ```

2. **Click "Run workflow"**

3. **Select options:**
   - Environment: `dev` (first time)
   - Operation: `plan` (first time)
   - Cloud Run Image: (leave blank)

4. **Review the plan output**
   - Should see resources to be created
   - Look for VPC, Cloud SQL, Cloud Run

5. **If plan looks good, run again with Operation: `apply`**

---

## 4. Project Structure

```
propeliq-copilot/
├── .github/
│   ├── workflows/          # Active CI/CD workflows
│   │   ├── ci.yml
│   │   ├── security-gates.yml
│   │   └── gcp-terraform-deploy.yml
│   ├── instructions/       # Development standards (40+ files)
│   ├── prompts/            # MCP agent prompts
│   └── agents/             # Agentic orchestrators
├── .propel/
│   ├── context/
│   │   ├── docs/           # Specifications
│   │   ├── iac/            # Terraform modules (GCP)
│   │   ├── tasks/          # User stories & task breakdown
│   │   └── wireframes/     # UI/UX designs
│   ├── templates/          # Code generation templates
│   ├── rules/              # Development standards
│   └── orchestrators/      # Agent workflows
├── src/
│   ├── frontend/           # React app (when added)
│   └── api/                # .NET API (when added)
├── docker-compose.yml      # Local dev services
├── Dockerfile.api          # API containerization
├── Dockerfile.frontend     # Frontend containerization
├── tsconfig.json           # TypeScript config
├── playwright.config.ts    # E2E testing config
├── GCP_SETUP.md           # GCP deployment guide
├── VALIDATION.md          # Project validation checklist
└── README.md              # Main documentation
```

---

## 5. Common Tasks

### Format TypeScript/JavaScript

```bash
npm run lint:fix
```

### Run Tests Locally

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Terraform

```bash
cd .propel/context/iac/gcp/terraform

# Plan deployment
terraform plan -var-file=environments/dev/dev.tfvars \
  -backend-config=environments/dev/backend.hcl

# Apply deployment
terraform apply -var-file=environments/dev/dev.tfvars \
  -backend-config=environments/dev/backend.hcl
```

---

## 6. Troubleshooting

### Docker Services Won't Start

```bash
# Clear previous containers/volumes
docker-compose down -v

# Rebuild
docker-compose build

# Start with verbose output
docker-compose up
```

### PostgreSQL Connection Error

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View logs
docker logs propeliq-postgres

# Restart
docker-compose restart postgres
```

### Terraform Init Fails

```bash
# Verify you've completed GCP_SETUP.md Phase 2
# Check that backend.hcl has valid values
cat .propel/context/iac/gcp/terraform/environments/dev/backend.hcl
```

---

## 7. Next Steps

- [ ] Follow [GCP_SETUP.md](GCP_SETUP.md) for cloud deployment
- [ ] Review [VALIDATION.md](VALIDATION.md) for quality checks
- [ ] Generate application code using orchestrators
- [ ] Run `ci.yml` workflow by pushing to main branch

---

**Need Help?**

- [GCP Setup Guide](GCP_SETUP.md)
- [Project Validation](VALIDATION.md)
- [Development Standards](.github/instructions/)
- [Architecture Docs](.propel/context/docs/)

---

**Last Updated**: 2026-04-22
