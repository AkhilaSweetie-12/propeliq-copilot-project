# CI/CD Workflows Comparison Matrix

Detailed side-by-side comparison of all three active GitHub Actions workflows.

---

## Workflow Properties

| Property | CI (`ci.yml`) | Security Gates (`security-gates.yml`) | GCP Deploy (`gcp-terraform-deploy.yml`) |
|----------|--------------|---------------------------------------|----------------------------------------|
| **File** | `.github/workflows/ci.yml` | `.github/workflows/security-gates.yml` | `.github/workflows/gcp-terraform-deploy.yml` |
| **Purpose** | Test & build application | Scan for vulnerabilities & secrets | Deploy infrastructure to GCP |
| **Status** | [DONE] Active | [DONE] Active | [DONE] Active |

---

## Trigger Events

### CI Workflow (`ci.yml`)

| Trigger | Event | Behavior |
|---------|-------|----------|
| **Push to main** | `push: branches: [main]` | Runs immediately |
| **Pull Request** | `pull_request: branches: [main]` | Runs on every PR |
| **Manual** | `workflow_dispatch` | Start from Actions tab |
| **Schedule** | [FAIL] None | Only event-driven |
| **Push Path** | [FAIL] None | Always runs on main push |

### Security Gates Workflow (`security-gates.yml`)

| Trigger | Event | Behavior |
|---------|-------|----------|
| **Push to main** | `push: branches: [main]` | Runs immediately |
| **Pull Request** | `pull_request: branches: [main]` | Runs on every PR |
| **Manual** | `workflow_dispatch` | Start from Actions tab |
| **Schedule** | [DONE] `0 3 * * 1` | Every Monday 03:00 UTC |
| **Push Path** | [FAIL] None | Always runs on main push |

### GCP Deploy Workflow (`gcp-terraform-deploy.yml`)

| Trigger | Event | Behavior |
|---------|-------|----------|
| **Push to main** | `push: branches: [main]` | Only if iac files changed |
| **Push Path** | [DONE] `.propel/context/iac/gcp/terraform/**` | Automatic plan only |
| **Manual** | `workflow_dispatch` with inputs | Start from Actions tab |
| **Pull Request** | [FAIL] None | Not on PRs |
| **Schedule** | [FAIL] None | Only event-driven |

---

## Concurrency & Queueing

| Workflow | Concurrency | Behavior | Max Duration |
|----------|-------------|----------|--------------|
| **CI** | `ci-${{ github.ref }}` | [WARN] Cancel in-progress on new push | 45 min |
| **Security** | `security-${{ github.ref }}` | [WARN] Cancel in-progress on new push | 15 min |
| **GCP Deploy** | `gcp-terraform-${{ environment }}` | [FAIL] Never cancel (serialize deploys) | 10 min |

**Note:** GCP Deploy is serialized per environment to prevent concurrent modifications to infrastructure.

---

## Job Composition

### CI Workflow Jobs

```
Total Jobs: 5 (1 mandatory + 3 conditional + 1 final)

┌─────────────────────────────────────┐
│ DETECT-STACK (Mandatory)            │
│ - Checks for .NET, Node, E2E files  │
│ - Outputs: flags for conditional    │
│ - Duration: <1 min                  │
└─────────────────────────────────────┘
       ↓ (outputs: has_dotnet, has_frontend, has_e2e)
   ├─→ API-TESTS (if has_dotnet=true)
   │   - Services: PostgreSQL 16, Redis 7
   │   - Steps: restore, build, migrate, test
   │   - Duration: 20-25 min
   │
   ├─→ FRONTEND-TESTS (if has_frontend=true)
   │   - Setup: Node.js 20.x
   │   - Steps: install, lint, build, unit-test
   │   - Duration: 15-20 min
   │
   └─→ E2E-TESTS (if has_e2e=true)
       - Setup: Node.js + Playwright
       - Browsers: Chromium, Firefox, WebKit, Mobile
       - Duration: 25-30 min

┌─────────────────────────────────────┐
│ SUMMARY (Awaits all above)          │
│ - Aggregates results                │
│ - Reports overall status            │
│ - Duration: <1 min                  │
└─────────────────────────────────────┘
```

### Security Gates Jobs

```
Total Jobs: 4 (all parallel)

┌──────────────────────────────────────────────────────┐
│ DEPENDENCY-REVIEW (PR-only)                          │
│ - Scope: Only runs on pull_request events            │
│ - Check: New npm/nuget packages for vulns            │
│ - Severity: FAIL on HIGH or CRITICAL                │
│ - Duration: 2-5 min                                  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ CODEQL (Matrix: 2 languages)                         │
│ - Language 1: javascript-typescript                  │
│ - Language 2: csharp                                 │
│ - Check: OWASP Top 10, CWE vulns                     │
│ - Duration: 8-10 min (per language)                  │
│ - Output: GitHub Security tab → Code scanning       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ SECRET-SCAN (Gitleaks)                               │
│ - Check: AWS keys, GitHub tokens, private keys      │
│ - Scope: Entire repo including history              │
│ - Duration: 2-3 min                                  │
│ - Output: GitHub Secret scanning tab                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ FILESYSTEM-SCAN (Trivy)                              │
│ - Check: Config files, deps, base images             │
│ - Severity: CRITICAL and HIGH only                   │
│ - Format: SARIF (GitHub-native)                      │
│ - Duration: 3-5 min                                  │
│ - Output: GitHub Security tab → Code scanning       │
└──────────────────────────────────────────────────────┘
```

### GCP Deploy Job

```
Total Jobs: 1 (environment-aware)

┌─────────────────────────────────────────────────────────┐
│ TERRAFORM (Single job, runs sequentially)              │
│                                                         │
│ Steps (in order):                                       │
│  1. Checkout                     <1 min                │
│  2. Setup Terraform              <1 min                │
│  3. Authenticate (OIDC)          1-2 min               │
│  4. Setup gcloud                 <1 min                │
│  5. Resolve env files            <1 min                │
│  6. Terraform Init               2-3 min               │
│  7. Format Check                 <1 min                │
│  8. Validate                     <1 min                │
│  9. Plan (output: tfplan)        2-3 min               │
│ 10. Upload Plan Artifact         <1 min                │
│ 11. [CONDITIONAL] Apply (if op=apply)  5-7 min        │
│                                                         │
│ Timeout: 20 min                                        │
└─────────────────────────────────────────────────────────┘
```

---

## Input Parameters

### CI Workflow
```
No inputs required - fully automatic
```

### Security Gates
```
No inputs required - fully automatic
Optional: Manual dispatch overrides schedule
```

### GCP Deploy
```
Trigger: workflow_dispatch (manual)

Required Inputs:
  ├─ environment (choice)
  │  ├─ dev
  │  ├─ staging
  │  └─ prod
  │
  └─ operation (choice, default: plan)
     ├─ plan (dry-run, no changes)
     └─ apply (actual deployment)

Optional Inputs:
  └─ cloud_run_image (string)
     └─ Override image from tfvars (e.g., us-central1-docker.pkg.dev/...)
```

---

## Permissions

| Workflow | Permissions | Reason |
|----------|-------------|--------|
| **CI** | `contents: read` | Read source code |
| **Security Gates** | `contents: read` + `security-events: write` + `actions: read` | Read code, write findings, read action status |
| **GCP Deploy** | `contents: read` + `id-token: write` | Read code, create OIDC tokens for GCP auth |

---

## Required GitHub Secrets

### CI Workflow
```
Optional:
  └─ CI_JWT_SIGNING_KEY (used by test environment)
     └─ For API tests that need signed JWT tokens
```

### Security Gates
```
None (uses GitHub's built-in scanning)
```

### GCP Deploy
```
Required (all must be set):
  ├─ GCP_WORKLOAD_IDENTITY_PROVIDER (string)
  │  └─ Resource name of OIDC provider (long format)
  │  └─ Example: projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider
  │
  └─ GCP_TERRAFORM_SERVICE_ACCOUNT (string)
     └─ Service account email
     └─ Example: terraform@PROJECT_ID.iam.gserviceaccount.com

Optional (stored in repo, not secrets):
  └─ TERRAFORM_BUCKET (in code)
     └─ GCS bucket name for Terraform state
```

---

## Artifact Handling

| Workflow | Artifacts | Retention | Download |
|----------|-----------|-----------|----------|
| **CI** | API test results (XML) | 30 days | GitHub Actions → CI run → Artifacts |
| **CI** | Playwright report (HTML) | 30 days | GitHub Actions → CI run → Artifacts |
| **Security** | SARIF files | GitHub native | GitHub Security tab → Code scanning |
| **GCP Deploy** | tfplan file | 7 days | GitHub Actions → Deploy run → Artifacts |

---

## Failure Behavior

| Workflow | Job Fails | Impact |
|----------|-----------|--------|
| **CI** | API tests fail | [FAIL] Blocks merge to main |
| **CI** | Frontend tests fail | [FAIL] Blocks merge to main |
| **CI** | E2E tests fail | [FAIL] Blocks merge to main |
| **Security** | CodeQL finds HIGH | [FAIL] Blocks merge to main |
| **Security** | Secret found | [FAIL] Blocks merge to main |
| **Security** | Dependency vulnerable | [FAIL] Blocks merge to main (PR only) |
| **GCP Deploy** | Plan fails | [WARN] Visible in Actions, no auto-apply |
| **GCP Deploy** | Apply fails | [WARN] Manual re-run needed |

---

## Performance Summary

| Workflow | Avg Runtime | Bottleneck | Parallel Jobs |
|----------|-------------|-----------|--------------|
| **CI** | 40-45 min | E2E tests (30 min) | 4 |
| **Security** | 10-15 min | CodeQL (10 min) | 4 |
| **GCP Deploy** | 5-10 min | Terraform apply (7 min) | 1 |

**Critical Path (full cycle):**
```
Main branch push
    ↓ (1 min: detection)
CI + Security in parallel
    ├─ CI: 40-45 min (E2E slowest)
    └─ Security: 10-15 min
    ↓ (45 min total for both to complete)
IF iac changed: GCP plan auto-runs (5 min)
    ↓ (manual approval)
Manual dispatch: GCP apply (7 min)
    ↓
Total: ~60 minutes (full pipeline)
```

---

## Workflow Selection Guide

### Use CI Workflow When...
- [DONE] Push to main branch
- [DONE] Need to verify code compiles
- [DONE] Need to run unit tests
- [DONE] Need to validate E2E scenarios
- [DONE] Before merging to main

### Use Security Gates When...
- [DONE] Push to main branch (automatic)
- [DONE] PR to main (detects new vulns)
- [DONE] Weekly scan (Monday 3 AM UTC)
- [DONE] Need to check for leaked secrets
- [DONE] Need static code analysis (CodeQL)

### Use GCP Deploy When...
- [DONE] Terraform infrastructure changed
- [DONE] Deploying to dev/staging/prod
- [DONE] Need to preview changes (plan)
- [DONE] Need to apply infrastructure (apply)
- [DONE] Manual deployment (workflow_dispatch)

---

## Common Workflows

### Workflow A: Daily Development
```
Developer pushes feature → main
    ↓
[Automatic]
├─ CI tests run (40-45 min)
├─ Security gates run (10-15 min)
└─ All checks pass

[Developer]
├─ Reviews test results
└─ Code is ready for deployment
```

### Workflow B: Infrastructure Change
```
Developer updates terraform files → main
    ↓
[Automatic]
├─ CI/Security gates run (standard)
└─ GCP Terraform plan auto-runs (5 min)

[Developer]
├─ Reviews terraform plan
├─ Approves in GitHub Environment
└─ Manually triggers apply in Actions
    ↓
[Automatic]
└─ GCP resources deployed (5-10 min)
```

### Workflow C: Production Deployment
```
Developer manually triggers GCP Deploy
    ↓
[Manual Input]
├─ environment: prod
├─ operation: plan
└─ [Workflow runs]
    ↓
[Developer + Team Lead]
├─ Review plan output
├─ Request approvals
└─ 2+ team members approve
    ↓
[Developer]
├─ Re-run workflow with operation: apply
└─ Production infrastructure deploys
```

---

**Last Updated:** 2026-04-22

