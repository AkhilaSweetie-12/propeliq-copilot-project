# Pipeline Documentation Index

Complete guide to all GitHub Actions CI/CD workflows and their stages.

---

## Quick Navigation

### For Developers
- [QUICK REFERENCE] [PIPELINE_REFERENCE.md](PIPELINE_REFERENCE.md) — Quick visual guide (start here!)
  - What runs when
  - Visual flow diagrams
  - Approval gates
  - Quick troubleshooting

- [DIAGRAMS] [PIPELINE_DIAGRAMS.md](PIPELINE_DIAGRAMS.md) — Detailed ASCII flow charts
  - Complete pipeline flow
  - Each workflow stage breakdown
  - Decision trees
  - Error handling

### For DevOps/Architects
- [COMPARISON] [WORKFLOWS_COMPARISON.md](WORKFLOWS_COMPARISON.md) — Detailed comparison matrix
  - Trigger events
  - Job composition
  - Concurrency behavior
  - Performance metrics
  - Failure scenarios

- [REFERENCE] [PIPELINE_STAGES.md](PIPELINE_STAGES.md) — Comprehensive reference
  - Stage dependency graph
  - Job descriptions
  - Environment gates
  - Troubleshooting guide

### For Setup/Deployment
- [SETUP] [GCP_SETUP.md](GCP_SETUP.md) — GCP infrastructure setup (Phases 1-5)
- [QUICKSTART] [QUICKSTART.md](QUICKSTART.md) — 5-minute local getting started
- [VALIDATION] [VALIDATION.md](VALIDATION.md) — Project completeness checklist

---

## The Three Active Workflows

### 1. Continuous Integration (`ci.yml`)
**What it does:** Test and build application code

| Property | Value |
|----------|-------|
| **Triggers** | Push to main, PR to main, Manual |
| **Jobs** | 5 (Detect + 3 tests + Summary) |
| **Duration** | 40-45 minutes |
| **Key Stages** | Stack detection → API/Frontend/E2E tests |
| **Failure Impact** | [FAIL] Blocks merge to main |

**When to check:** After every push or PR to main

---

### 2. Security Gates (`security-gates.yml`)
**What it does:** Scan for vulnerabilities and secrets

| Property | Value |
|----------|-------|
| **Triggers** | Push/PR to main, Weekly (Mon 03:00 UTC), Manual |
| **Jobs** | 4 (all parallel) |
| **Duration** | 10-15 minutes |
| **Key Stages** | Dependencies, CodeQL, Secrets, Filesystem |
| **Failure Impact** | [FAIL] Blocks merge to main |

**When to check:** Before merging security-critical changes

---

### 3. GCP Infrastructure Deploy (`gcp-terraform-deploy.yml`)
**What it does:** Deploy infrastructure to Google Cloud

| Property | Value |
|----------|-------|
| **Triggers** | Manual dispatch, Auto on iac file changes |
| **Jobs** | 1 (sequential) |
| **Duration** | 3-5 min (plan), 5-10 min (apply) |
| **Key Stages** | Validate → Auth → Init → Plan → [Apply] |
| **Failure Impact** | [WARN] Visible in Actions, manual re-run needed |

**When to check:** After infrastructure changes (Terraform files)

---

## Stage Execution Sequence

### Typical Developer Workflow

```
1. Developer pushes to main
   ↓
2. [Automatic] CI workflow runs (40-45 min)
   ├─ Detect stack
   ├─ API tests (if .NET found)
   ├─ Frontend tests (if Node found)
   ├─ E2E tests (if Playwright found)
   └─ Summary
   ↓
3. [Automatic] Security gates run (10-15 min, parallel with CI)
   ├─ Dependency review
   ├─ CodeQL analysis
   ├─ Secret scanning
   └─ Filesystem scanning
   ↓
4. [Automatic] If iac files changed:
   └─ GCP Terraform plan runs (5 min, shows changes only)
   ↓
5. [Manual] Review terraform plan output
   ↓
6. [Manual] Developer triggers GCP apply in Actions
   (Infrastructure deployed in 5-10 min)
```

---

## Documentation by Use Case

### "I'm running CI for the first time"
1. Read: [PIPELINE_REFERENCE.md](PIPELINE_REFERENCE.md#1-on-every-push-to-main)
2. See: Stages that run on every push
3. Check: GitHub Actions → CI tab

### "A test failed. What do I do?"
1. See: [PIPELINE_REFERENCE.md](PIPELINE_REFERENCE.md#troubleshooting-which-stage-failed)
2. Find: Which stage failed (API, Frontend, E2E)
3. Read: Corresponding section in [PIPELINE_STAGES.md](PIPELINE_STAGES.md)
4. Fix: Code issue + push again

### "Security gates blocked my PR. Why?"
1. Check: GitHub PR → Security tab
2. See: Which scan failed (CodeQL, Secrets, Dependencies)
3. Read: Troubleshooting in [PIPELINE_REFERENCE.md](PIPELINE_REFERENCE.md#-security-gates-failed)
4. Fix: Update dependencies or remove secrets

### "I want to deploy to GCP"
1. Read: [GCP_SETUP.md](GCP_SETUP.md) (one-time setup)
2. Follow: All Phases 1-5
3. Then: [PIPELINE_REFERENCE.md](PIPELINE_REFERENCE.md#3-manual-deploy-to-gcp)
4. Deploy: Manual dispatch to Actions

### "I need to understand the approval process"
1. See: [WORKFLOWS_COMPARISON.md](WORKFLOWS_COMPARISON.md#environment-specific-flow)
2. Dev: No approval needed
3. Staging: 1 approver required
4. Prod: 2+ approvers required

### "I'm investigating a performance issue"
1. Check: [WORKFLOWS_COMPARISON.md](WORKFLOWS_COMPARISON.md#performance-summary)
2. See: Bottleneck (E2E tests are slowest)
3. Consider: Parallelization opportunities

### "I need to troubleshoot a failed deployment"
1. See: [PIPELINE_DIAGRAMS.md](PIPELINE_DIAGRAMS.md#detailed-gcp-deploy-workflow)
2. Find: Which step failed
3. Check: Error message in GitHub Actions logs
4. Read: Corresponding troubleshooting section

---

## File Structure

```
PropelIQ-Copilot/
│
├── .github/workflows/          # Active workflows (3)
│   ├── ci.yml                  # Continuous Integration
│   ├── security-gates.yml      # Security Scanning
│   └── gcp-terraform-deploy.yml   # Infrastructure Deployment
│
├── .propel/context/iac/        # Infrastructure Code
│   └── gcp/terraform/
│       ├── main.tf
│       ├── providers.tf
│       ├── variables.tf
│       ├── modules/platform/
│       └── environments/
│           ├── dev/
│           ├── staging/
│           └── prod/
│
├── PIPELINE_STAGES.md          # [REFERENCE] Comprehensive reference
├── PIPELINE_REFERENCE.md       # [LAUNCH] Quick visual guide
├── PIPELINE_DIAGRAMS.md        # [CHART] Flow diagrams
├── WORKFLOWS_COMPARISON.md     # 📋 Detailed comparison
├── PIPELINE_INDEX.md           # 📑 This file
│
├── GCP_SETUP.md                # [SETUP] GCP infrastructure setup
├── QUICKSTART.md               # [QUICK] 5-minute start
├── VALIDATION.md               # [DONE] Validation checklist
│
├── README.md                   # Project overview
└── docker-compose.yml          # Local development
```

---

## Common Questions

### Q: How long does CI take?
**A:** ~40-45 minutes (parallel jobs). E2E tests are the bottleneck (30 min).

### Q: Can I skip security gates?
**A:** No, security gates must pass before merge. They cannot be skipped or disabled.

### Q: How do approval gates work?
**A:** 
- Dev environment: Auto-deploy (no approval)
- Staging: 1 approval required
- Prod: 2+ approvals required

See [WORKFLOWS_COMPARISON.md](WORKFLOWS_COMPARISON.md#environment-specific-flow)

### Q: What if Terraform apply fails?
**A:** The workflow stops. Review logs in GitHub Actions. Fix the issue and manually re-run the apply step.

### Q: Can I deploy to prod without approval?
**A:** No. Prod always requires 2+ approvers. This is enforced by GitHub environment rules.

### Q: How often does security scanning run?
**A:** 
- Always on: Every push/PR
- Scheduled: Every Monday at 03:00 UTC

See [PIPELINE_STAGES.md](PIPELINE_STAGES.md#stage-status-indicators)

### Q: Why is there a separate E2E tests job?
**A:** E2E tests are slow (30 min) and can run in parallel with API/Frontend tests. This provides faster feedback.

---

## Monitoring & Alerts

### Where to Check Status

| Status | Location | How to Access |
|--------|----------|---------------|
| **CI Tests** | GitHub Actions | Repo → Actions → CI tab |
| **Security Scans** | GitHub Security tab | Repo → Security → Code scanning |
| **Terraform** | GitHub Actions | Repo → Actions → GCP Terraform Deploy |
| **Merge Status** | PR checks | PR → Show all checks |

### Critical Alerts to Watch

- [FAIL] **API tests failed** → Code syntax/logic error
- [FAIL] **CodeQL found issues** → Potential security vulnerability
- [FAIL] **Secret detected** → Remove API keys/tokens immediately
- [FAIL] **Terraform plan shows unwanted deletions** → Review carefully before apply

---

## Performance Tuning

### Improving CI Speed

**Current bottleneck:** E2E tests (30 min)

**Options:**
1. Reduce Playwright browsers (remove Safari, use 2 instead of 5)
2. Run tests in shards (split across multiple jobs)
3. Skip E2E on every commit (manual trigger only)

### Improving Security Scan Speed

**Current bottleneck:** CodeQL (10 min)

**Options:**
1. Limit to main branch + PR (don't schedule on schedule)
2. Use CodeQL starter workflow (simpler rules)
3. Split languages into separate jobs

---

## Maintenance

### Weekly Tasks
- [ ] Review security scan results (Monday after 03:00 UTC)
- [ ] Update dependencies if vulnerabilities found
- [ ] Check Terraform state for drift

### Monthly Tasks
- [ ] Review CI performance metrics
- [ ] Clean up old workflow artifacts
- [ ] Update GitHub Actions versions

### Quarterly Tasks
- [ ] Review approval policies
- [ ] Audit environment access
- [ ] Update documentation with new stages

---

## Additional Resources

| Resource | Link | Purpose |
|----------|------|---------|
| GitHub Actions Docs | https://docs.github.com/en/actions | Official reference |
| Terraform Docs | https://www.terraform.io/docs | Infrastructure as Code |
| Google Cloud | https://cloud.google.com/docs | GCP services |
| Security Best Practices | `.github/instructions/` | Development standards |

---

**Last Updated:** 2026-04-22  
**Framework:** GitHub Actions  
**Status:** All 3 workflows active and documented

