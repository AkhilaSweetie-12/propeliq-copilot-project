# GitHub Actions Pipeline Stages Overview

This document maps all stages across the three active CI/CD workflows.

---

## Workflow 1: Continuous Integration (`ci.yml`)

**Trigger Events:**
- Push to `main` branch
- Pull Request to `main` branch
- Manual dispatch (workflow_dispatch)

**Run Duration:** ~35-45 minutes (parallel jobs)

### Pipeline Stages

```
DETECT STACK (Mandatory - Gatekeeper)
│
├─ Scan for .NET sources (*.sln, *.csproj)
├─ Scan for Frontend sources (package.json)
├─ Scan for E2E tests (e2e/package.json)
│
└─ Output: Boolean flags (has_dotnet, has_frontend, has_e2e)
   
   ├─→ API TESTS (Conditional - if has_dotnet=true)
   │   │
   │   ├─ Service: PostgreSQL 16 (pgvector) on 5433
   │   ├─ Service: Redis 7 on 6379
   │   │
   │   ├─ Restore local tools
   │   ├─ Restore dependencies
   │   ├─ Build (Release config)
   │   ├─ Run EF Core migrations (if applicable)
   │   ├─ Run unit tests (JUnit format)
   │   └─ Upload test artifacts
   │
   ├─→ FRONTEND TESTS (Conditional - if has_frontend=true)
   │   │
   │   ├─ Setup Node.js 20.x
   │   ├─ Install dependencies (npm ci)
   │   ├─ Lint code (continue on error)
   │   ├─ Build production bundle
   │   ├─ Run unit tests (continue on error)
   │   └─ Report results
   │
   └─→ E2E TESTS (Conditional - if has_e2e=true)
       │
       ├─ Setup Node.js 20.x
       ├─ Install dependencies (npm ci)
       ├─ Install Playwright browsers
       ├─ Run Playwright test suite
       └─ Upload Playwright report

SUMMARY JOB (Final - Reports status)
│
├─ Aggregate all test results
├─ Report pass/fail status
└─ Trigger downstream workflows (if needed)
```

### Key Features

| Feature | Detail |
|---------|--------|
| **Parallelization** | API, Frontend, E2E tests run in parallel (faster feedback) |
| **Timeout** | API: 25 min, Frontend: 20 min, E2E: 30 min |
| **Concurrency** | Only 1 run per branch at a time; cancels in-progress runs |
| **Artifact Upload** | Test results stored for 30 days |
| **Error Handling** | Lint/tests continue on error; build failures block pipeline |

---

## Workflow 2: Security Gates (`security-gates.yml`)

**Trigger Events:**
- Push to `main` branch
- Pull Request to `main` branch
- **Weekly schedule:** Monday 3:00 AM UTC
- Manual dispatch (workflow_dispatch)

**Run Duration:** ~10-15 minutes (parallel scanning)

### Pipeline Stages

```
SECURITY GATES (Parallel Scanners)
│
├─→ DEPENDENCY REVIEW (PR-only)
│   │
│   ├─ Trigger: Only on pull_request events
│   ├─ Check: New npm/nuget package versions
│   ├─ Severity: FAIL on HIGH or CRITICAL
│   └─ Report: GitHub Advisory Database
│
├─→ CODEQL ANALYSIS (Multi-language)
│   │
│   ├─ Language 1: JavaScript/TypeScript
│   │  ├─ Initialize CodeQL database
│   │  ├─ Auto-build (Javac, TypeScript, etc.)
│   │  └─ Analyze against OWASP Top 10
│   │
│   ├─ Language 2: C#
│   │  ├─ Initialize CodeQL database
│   │  ├─ Auto-build (.NET projects)
│   │  └─ Analyze for CWE vulnerabilities
│   │
│   └─ Upload: GitHub Security tab → Code scanning alerts
│
├─→ SECRET SCANNING (Gitleaks)
│   │
│   ├─ Check: All files for exposed credentials
│   ├─ Pattern: AWS keys, GitHub tokens, private keys, etc.
│   ├─ Scope: Entire repo including history
│   └─ Report: GitHub Secret scanning tab
│
└─→ FILESYSTEM SCANNING (Trivy)
    │
    ├─ Scan: Config files, dependencies, base images
    ├─ Severity: Report CRITICAL and HIGH only
    ├─ Format: SARIF (GitHub-native)
    └─ Upload: GitHub Security tab → Code scanning alerts
```

### Key Features

| Feature | Detail |
|---------|--------|
| **Parallelization** | All 4 scans run in parallel |
| **Schedule** | Weekly on Monday 03:00 UTC (catch issues early) |
| **Multi-language** | CodeQL covers JS/TS and C# simultaneously |
| **Continue on Error** | One failing scan doesn't block others |
| **Severity Filtering** | Only HIGH/CRITICAL issues reported (reduces noise) |
| **GitHub Integration** | Findings appear in Security tab → Code scanning |

---

## Workflow 3: GCP Infrastructure Deploy (`gcp-terraform-deploy.yml`)

**Trigger Events:**
- **Manual dispatch** (workflow_dispatch) with inputs:
  - `environment`: dev / staging / prod
  - `operation`: plan / apply
  - `cloud_run_image`: (optional override)
- **Automatic push** to `main` if `.propel/context/iac/gcp/terraform/**` changed

**Run Duration:** ~3-5 minutes (plan), ~5-10 minutes (apply)

### Pipeline Stages

```
TERRAFORM DEPLOYMENT (Single job, environment-aware)
│
├─ VALIDATION PHASE
│  │
│  ├─ Checkout code
│  ├─ Resolve environment files (tfvars, backend.hcl)
│  ├─ Validate: Files exist (tfvars and backend config)
│  └─ Output: environment, tfvars_file, backend_file paths
│
├─ AUTHENTICATION PHASE
│  │
│  ├─ Setup Terraform CLI
│  ├─ Authenticate to GCP via OIDC (GitHub → GCP)
│  │  └─ No long-lived keys; token expires in 1 hour
│  ├─ Setup gcloud SDK
│  └─ Verify: gcloud can access GCP resources
│
├─ TERRAFORM INIT PHASE
│  │
│  ├─ Initialize Terraform working directory
│  ├─ Configure backend: GCS bucket (remote state)
│  ├─ Download provider plugins (google, random, etc.)
│  └─ Lock state file
│
├─ VALIDATION PHASE
│  │
│  ├─ Format check: terraform fmt -check -recursive
│  │  └─ Ensures consistent code style
│  │
│  ├─ Validate: terraform validate
│  │  └─ Checks HCL syntax and module compatibility
│  │
│  └─ Output: Any formatting or validation errors
│
├─ PLAN PHASE (Always runs)
│  │
│  ├─ Generate plan: terraform plan
│  ├─ Input: tfvars (variable values per environment)
│  ├─ Input: Optional cloud_run_image override
│  ├─ Output: tfplan binary file
│  │
│  ├─ Actions shown:
│  │  ├─ (+) Resources to create (VPC, Cloud SQL, Cloud Run, etc.)
│  │  ├─ (~) Resources to modify
│  │  └─ (-) Resources to delete
│  │
│  └─ Upload: Plan artifact (retention: 7 days)
│
└─ APPLY PHASE (Conditional - only if operation=apply)
   │
   ├─ Trigger: Manual dispatch with operation: apply
   ├─ Approval: Environment approval gates (prod requires 2+ reviewers)
   │
   ├─ Execute: terraform apply -input=false tfplan
   │  ├─ Create VPC network
   │  ├─ Create Cloud SQL PostgreSQL instance
   │  ├─ Create Cloud KMS keys
   │  ├─ Create Secret Manager secrets
   │  ├─ Create Cloud Run service
   │  ├─ Configure OIDC workload identity
   │  └─ Output: Resource IDs, endpoints, etc.
   │
   └─ Result: Infrastructure deployed to GCP
```

### Environment Approval Gates

| Environment | Approval Required | Reviewer Count | Use Case |
|-------------|------------------|-----------------|----------|
| **dev** | [FAIL] No | N/A | Instant deploy for testing |
| **staging** | [DONE] Yes | 1 | Manual approval before staging |
| **prod** | [DONE] Yes | 2+ | Multiple eyes before production |

### Key Features

| Feature | Detail |
|---------|--------|
| **OIDC Auth** | GitHub → GCP without long-lived keys (1-hour token) |
| **Plan + Apply** | Manual workflow: plan first, review output, then apply |
| **Idempotent** | Safe to run multiple times; only changes what's needed |
| **State Management** | Remote state in GCS (shared, encrypted, versioned) |
| **Artifact Retention** | tfplan uploaded for audit trail (7 days) |
| **Concurrency** | Only 1 deploy per environment at a time |

---

## Pipeline Execution Flow

### Scenario 1: Developer Pushes to `main`

```
[Git push to main]
           ↓
    ╔═════════════════╗
    ║   CI Workflow   ║  Automatic: Detect stack → API/Frontend/E2E tests
    ╚═════════════════╝
           ↓
    ╔═════════════════╗
    ║ Security Gates  ║  Automatic: CodeQL, Secrets, Trivy, Dependencies
    ╚═════════════════╝
           ↓
    [Status checks visible on GitHub]
           ↓
    IF iac files changed:
    ╔═════════════════╗
    ║  GCP Deploy     ║  Automatic: terraform plan only (shows what would change)
    ║  (plan-only)    ║
    ╚═════════════════╝
           ↓
    [Review plan in GitHub Actions logs, decide to apply manually]
```

### Scenario 2: Manual Terraform Deploy

```
[GitHub Actions → GCP Terraform Deploy]
           ↓
[Select: environment=dev, operation=plan]
           ↓
[terraform plan runs]
           ↓
[Review output → looks good]
           ↓
[Re-run workflow: environment=dev, operation=apply]
           ↓
[terraform apply runs]
           ↓
[Infrastructure deployed to GCP]
```

### Scenario 3: Pull Request to `main`

```
[PR created: feature-branch → main]
           ↓
    ╔═════════════════╗
    ║   CI Workflow   ║  Automatic on PR
    ╚═════════════════╝
           ↓
    ╔═════════════════╗
    ║ Security Gates  ║  Includes: Dependency Review (NPM/NuGet)
    ║ + Dependencies  ║
    ╚═════════════════╝
           ↓
    [Checks visible on PR → required before merge]
           ↓
    IF approved + all checks pass:
    [Merge button enabled]
```

---

## Stage Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────┐
│ CI WORKFLOW                                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DETECT-STACK (Mandatory)                                           │
│        ↓                                                            │
│    ├─→ API-TESTS (if has_dotnet=true)                               │
│    │        ↓                                                       │
│    │   [PostgreSQL + Redis services]                                │
│    │   [Restore, Build, Migrate, Test]                              │
│    │                                                                │
│    ├─→ FRONTEND-TESTS (if has_frontend=true)                        │
│    │        ↓                                                       │
│    │   [Node.js 20.x]                                               │
│    │   [Lint, Build, Unit Tests]                                    │
│    │                                                                │
│    └─→ E2E-TESTS (if has_e2e=true)                                  │
│             ↓                                                       │
│         [Playwright multi-browser]                                  │
│                                                                     │
│  SUMMARY (Awaits all above)                                         │
│        ↓                                                            │
│   [Report aggregate status]                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ SECURITY GATES WORKFLOW (Parallel)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DEPENDENCY-REVIEW ──┐                                              │
│  (PR only)           │                                              │
│                      ├─→ [All run in parallel]                      │
│  CODEQL ─────────────┤                                              │
│  (JS/TS + C#)        │                                              │
│                      ├─→ [Results → GitHub Security]                │
│  SECRET-SCAN ────────┤                                              │
│  (Gitleaks)          │                                              │
│                      │                                              │
│  FILESYSTEM-SCAN ────┘                                              │
│  (Trivy)                                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ GCP DEPLOY WORKFLOW (Manual / Conditional)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  VALIDATION → AUTH → INIT → VALIDATE → PLAN → [APPLY]              │
│              ↑      ↓      ↑        ↑     ↑      ↑                  │
│              │      │      │        │     │      └─ Manual input   │
│              │      │      │        │     │         operation=apply│
│              │      │      │        │     │                        │
│              │      │      │        │     └─ Approval gates        │
│              │      │      │        │        (prod: 2+ reviewers)  │
│              │      │      │        │                              │
│              │      │      │        └─ Artifact upload (tfplan)    │
│              │      │      │                                       │
│              │      │      └─ terraform fmt + validate             │
│              │      │                                              │
│              │      └─ Backend init (GCS)                          │
│              │                                                    │
│              └─ OIDC token (1 hour expiry)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stage Status Indicators

### CI Workflow Jobs

| Job | Required | Status |
|-----|----------|--------|
| `detect-stack` | [DONE] Yes | Must pass |
| `api-tests` | ❓ Conditional | Only if .NET files exist |
| `frontend-tests` | ❓ Conditional | Only if package.json exists |
| `e2e-tests` | ❓ Conditional | Only if e2e/package.json exists |
| `summary` | [DONE] Yes | Reports final status |

### Security Gates Jobs

| Job | Triggers | Required | Can Continue on Failure |
|-----|----------|----------|------------------------|
| `dependency-review` | PR only | [DONE] Yes | No (blocks merge) |
| `codeql` | All events | [DONE] Yes | No (blocks merge) |
| `secret-scan` | All events | [DONE] Yes | No (blocks merge) |
| `filesystem-scan` | All events | [DONE] Yes | No (blocks merge) |

### GCP Deploy Job

| Stage | Required | Can Skip |
|-------|----------|----------|
| Validation | [DONE] Yes | No |
| Authentication | [DONE] Yes | No |
| Init | [DONE] Yes | No |
| Validate | [DONE] Yes | No |
| Plan | [DONE] Yes | No |
| Apply | ❓ Conditional | Yes (manual gate) |

---

## Troubleshooting Pipeline Issues

### Issue: "API Tests Skipped"
**Cause:** No .NET files detected (missing *.sln or *.csproj)
**Solution:** Push .NET project files to repo

### Issue: "Dependency Review Failed"
**Cause:** New package with HIGH/CRITICAL vulnerability
**Solution:** Update package to patched version

### Issue: "CodeQL analysis failed"
**Cause:** Syntax error in TypeScript/C# code
**Solution:** Review logs, fix code, push again

### Issue: "Terraform Plan Failed: state bucket not found"
**Cause:** Backend bucket doesn't exist or wrong bucket name
**Solution:** Follow Phase 1-2 of GCP_SETUP.md

### Issue: "OIDC authentication failed"
**Cause:** Missing GitHub secrets or wrong values
**Solution:** Verify GCP_WORKLOAD_IDENTITY_PROVIDER and GCP_TERRAFORM_SERVICE_ACCOUNT secrets

---

## Performance Metrics

| Workflow | Avg Duration | Parallel Jobs | Critical Path |
|----------|--------------|---------------|---------------|
| CI | 35-45 min | 4 (detect + 3 tests) | E2E tests (30 min) |
| Security Gates | 10-15 min | 4 (all parallel) | CodeQL (10 min) |
| GCP Deploy Plan | 3-5 min | 1 | Terraform plan (2-3 min) |
| GCP Deploy Apply | 5-10 min | 1 | Infrastructure creation (5-7 min) |

**Total time for full CI → Deploy cycle:** ~50-70 minutes

---

**Last Updated:** 2026-04-22  
**Framework:** GitHub Actions  
**Environments:** dev, staging, prod

