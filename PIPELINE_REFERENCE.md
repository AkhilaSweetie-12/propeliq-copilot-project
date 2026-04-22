# Pipeline Stages Quick Reference

## At-a-Glance: What Runs When

### 1. On Every Push to `main`

```
CI WORKFLOW (ci.yml)
  ├─ [PASS] DETECT STACK (scan for .NET, Node, E2E)
  ├─ [RUN] API-TESTS (if .NET found) — 25 min timeout
  │  └─ Services: PostgreSQL 16, Redis 7
  ├─ [RUN] FRONTEND-TESTS (if package.json found) — 20 min
  │  └─ Tasks: Lint, Build, Unit tests
  ├─ [RUN] E2E-TESTS (if e2e/package.json found) — 30 min
  │  └─ Browser: Chromium, Firefox, WebKit, Mobile
  └─ [REPORT] SUMMARY (reports final status)

SECURITY GATES (security-gates.yml)
  ├─ [SCAN] DEPENDENCY REVIEW (PR only)
  ├─ [SCAN] CODEQL (JavaScript/TypeScript + C#)
  ├─ [SCAN] SECRET SCAN (Gitleaks - exposes API keys, tokens)
  └─ [SCAN] FILESYSTEM SCAN (Trivy - container/config vulns)

GCP DEPLOY (conditional - if iac files changed)
  └─ [PLAN] TERRAFORM PLAN ONLY
     (Shows what would change, no actual deployment)
```

**Total Duration:** ~50 minutes (parallel)  
**Status:** Visible on GitHub before merge

---

### 2. On Pull Request to `main`

```
Same as "Push to main" + Extra step:

SECURITY GATES
  └─ **DEPENDENCY REVIEW** (NPM/NuGet vulnerabilities)
     └─ Blocks merge if HIGH/CRITICAL found
```

**What Blocks Merge:**
- [FAIL] CI tests fail
- [FAIL] CodeQL issues (HIGH/CRITICAL)
- [FAIL] New vulnerabilities in dependencies
- [FAIL] Secrets detected in code

---

### 3. Manual Deploy to GCP

```
[TRIGGER] MANUAL: GitHub Actions → GCP Terraform Deploy

Step 1: Select Inputs
  ├─ Environment: dev | staging | prod
  ├─ Operation: plan | apply
  └─ Image: (optional override)

Step 2: Run Workflow
  ├─ VALIDATE (tfvars, backend.hcl exist)
  ├─ AUTH (OIDC to GCP)
  ├─ INIT (Terraform init with backend)
  ├─ VALIDATE (HCL syntax check)
  └─ PLAN (show resources: +create, ~modify, -delete)

Step 3: Review Plan
  ├─ Check what will be created/modified
  ├─ Look for VPC, Cloud SQL, Cloud Run, KMS, etc.
  └─ Verify no unexpected deletions

Step 4: Apply (manual re-run)
  └─ Re-run with operation: apply
     ├─ Requires approval if prod
     └─ Deploys to GCP (5-10 min)
```

**Approval Gates:**
- dev: [AUTO] Auto (no approval needed)
- staging: [MANUAL] Manual (1 reviewer required)
- prod: [STRICT] Strict (2+ reviewers required)

---

### 4. Weekly Security Scan (Automatic)

```
SECURITY GATES (Scheduled)
  ├─ Trigger: Every Monday 03:00 UTC
  ├─ Reason: Detect drift, new vulnerabilities
  └─ Jobs:
     ├─ CodeQL (deep static analysis)
     ├─ Gitleaks (secret exposure)
     └─ Trivy (infrastructure scanning)
```

---

## Stage Status Flow

```
┌──────────────────────────────────────────────────────┐
│                   PUSH TO MAIN                       │
└──────────────────────────────────────────────────────┘
                         ↓
         ┌───────────────┴───────────────┐
         ↓                               ↓
    ┌─────────────┐              ┌──────────────┐
    │   CI TEST   │              │ SECURITY     │
    │  (parallel) │              │ GATES        │
    └─────────────┘              │ (parallel)   │
         │                        └──────────────┘
         ├─ Detect Stack                    │
         ├─ API Tests                       ├─ Dependency Review
         ├─ Frontend Tests                  ├─ CodeQL
         └─ E2E Tests                       ├─ Secret Scan
                                            └─ Filesystem Scan
         ↓                                      ↓
    ┌─ Result ───────────────────────── Result ─┐
    │  [PASS] All pass                           │
    │  [WARN] Some warn (lint OK to continue)    │
    │  [FAIL] Any fail (blocks merge)            │
    └────────────────────────────────────────────┘
         ↓
    [Can now merge to main]
         ↓
    IF iac files changed:
    ├─ Terraform plan runs (automatic)
    └─ Review output, manually trigger apply
```

---

## Environment-Specific Flow

### DEV Environment
```
[Manual dispatch]
    ↓
[No approval needed]
    ↓
[Instant deploy]
    ↓
[Test in dev]
```

### STAGING Environment
```
[Manual dispatch]
    ↓
[Requires 1 approval]
    ↓
[Deploy after approval]
    ↓
[Pre-production testing]
```

### PROD Environment
```
[Manual dispatch]
    ↓
[Requires 2+ approvals]
    ↓
[Deploy after all approve]
    ↓
[Live production]
```

---

## Quick Checklist: What to Check

### After Push to main

- [ ] GitHub shows green checkmarks (CI + Security pass)
- [ ] No secrets exposed (secret-scan pass)
- [ ] CodeQL found no critical issues
- [ ] Dependencies have no HIGH vulns

### Before Terraform Apply

- [ ] Review `terraform plan` output
- [ ] Verify only expected resources in (+) section
- [ ] Check no critical resources in (-) section
- [ ] For prod: Get approvals from team

### After Apply Completes

- [ ] Cloud Run service created [DONE]
- [ ] Cloud SQL database running [DONE]
- [ ] VPC network configured [DONE]
- [ ] KMS encryption enabled [DONE]
- [ ] OIDC workload identity set up [DONE]

---

## Test the Pipelines Locally

### Test CI Workflow

```bash
# Install act (GitHub Actions local runner)
brew install act  # or download from github.com/nektos/act

# Test CI detection
act pull_request --job detect-stack

# Test all CI jobs
act pull_request

# Test specific job
act --job api-tests
```

### Test Security Scan

```bash
# Note: Some scans require API keys (CodeQL, Trivy)
# Just review the workflow YAML for now

# View what security-gates.yml does
cat .github/workflows/security-gates.yml
```

### Test Terraform

```bash
cd .propel/context/iac/gcp/terraform

# Validate syntax (no GCP credentials needed)
terraform init -backend=false
terraform validate
terraform fmt -check -recursive

# If GCP auth is set up:
terraform plan -var-file=environments/dev/dev.tfvars \
  -backend-config=environments/dev/backend.hcl
```

---

## Troubleshooting: Which Stage Failed?

### "CI workflow failed"
→ Check which job: API-Tests, Frontend-Tests, or E2E-Tests?
→ Open that job's logs
→ Look for error messages

### "Security gates failed"
→ Check which gate: CodeQL, Secrets, Dependencies, Trivy?
→ Visit GitHub Security tab for details
→ Fix the issue (update package, remove secret, fix code)

### "Terraform plan failed"
→ Check if tfvars/backend.hcl files exist
→ Verify OIDC secrets are set
→ Check Terraform syntax: `terraform validate`

---

**See full details:** [PIPELINE_STAGES.md](PIPELINE_STAGES.md)  
**See setup:** [GCP_SETUP.md](GCP_SETUP.md)  
**See getting started:** [QUICKSTART.md](QUICKSTART.md)
