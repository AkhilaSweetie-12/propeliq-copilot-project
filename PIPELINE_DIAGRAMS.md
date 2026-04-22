# Pipeline Flow Diagrams

Visual representations of the complete CI/CD pipeline flow.

---

## Complete Pipeline: From Code to Production

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPER WORKFLOW                                     │
└────────────────────────────────────────────────────────────────────────────────┘

┌─ CODE CHANGE ─────────────────────────────────────────────────────────────────┐
│                                                                                 │
│  Developer creates feature branch → makes changes → commits → pushes to repo  │
│                                                                                 │
└───────────────────────────────────────────────────────────────────────────────┬┘
                                                                                   │
                                                          ┌─────────────────────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────┐
                    │                                     │                         │
                    ↓                                     ↓                         ↓
        ┌──────────────────────┐          ┌──────────────────────┐      ┌──────────────────────┐
        │  EVENT: PR Created   │          │  EVENT: Push Main    │      │EVENT: Manual Trigger │
        │  OR Push to Main     │          │ (on any change)      │      │ (GCP Deploy only)    │
        └──────────────────────┘          └──────────────────────┘      └──────────────────────┘
                    │                                     │                         │
        ┌───────────┴──────────┐          ┌──────────────┴──────────┐            │
        │                      │          │                         │            │
        ↓                      ↓          ↓                         ↓            ↓
   ┌──────────┐          ┌──────────┐  ┌──────────┐          ┌──────────┐  ┌──────────────────┐
   │    CI    │          │SECURITY  │  │    CI    │          │SECURITY  │  │  GCP DEPLOY      │
   │ WORKFLOW │          │ GATES    │  │ WORKFLOW │          │ GATES    │  │  WORKFLOW        │
   │          │          │          │  │          │          │          │  │                  │
   │ (3 tests)│          │ (4 scans)│  │ (3 tests)│          │ (4 scans)│  │ (Plan + Apply)   │
   └────┬─────┘          └────┬─────┘  └────┬─────┘          └────┬─────┘  └────┬─────────────┘
        │                     │             │                     │            │
        └─────────────┬───────┘             └─────────────┬───────┘            │
                      │                                   │                     │
                      ↓                                   ↓                     │
            ┌──────────────────┐                 ┌──────────────────┐          │
            │ Status: PR Checks│                 │ Status: Required │          │
            │ PASS / FAIL      │                 │ Checks PASS/FAIL │          │
            └────────┬─────────┘                 └────────┬─────────┘          │
                     │                                    │                     │
        ┌────────────┴────────────┐         ┌────────────┴────────────┐       │
        │                         │         │                         │       │
        ↓                         ↓         ↓                         ↓       ↓
    [FAIL] FAIL              [PASS] PASS        [FAIL] FAIL              [PASS] PASS    [MANUAL]
    Merge blocked       Merge enabled  Ready to deploy     Deployed   Enter params
    Fix issues          Proceed        (if iac changed)    in main    (env, op, img)
                                       Terraform runs      branch
                                       in plan mode
                                       (shows changes,
                                        no deployment yet)


┌────────────────────────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT PHASE (Manual)                                 │
└────────────────────────────────────────────────────────────────────────────────┘

Developer reviews terraform plan output → Selects: env (dev/staging/prod) + op (plan/apply)

If operation = plan:
├─ Show resources to be created/modified
├─ Developer reviews output
├─ If OK: Re-run with operation = apply

If operation = apply:
├─ [For PROD: Requires 2+ approvals]
├─ Execute: terraform apply
├─ Create/modify infrastructure:
│  ├─ VPC Network
│  ├─ Cloud SQL PostgreSQL
│  ├─ Cloud Run service
│  ├─ Cloud KMS encryption
│  ├─ Secret Manager
│  └─ OIDC Workload Identity
└─ Result: Infrastructure deployed to GCP
```

---

## Detailed CI Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                    CI WORKFLOW (ci.yml)                          │
│  Triggered by: Push to main OR PR to main OR Manual dispatch    │
└──────────────────────────────────────────────────────────────────┘

                           START
                             │
                             ↓
                 ┌─────────────────────────┐
                 │  DETECT-STACK (Job 1)   │
                 │  (Mandatory - Gate Job) │
                 └────────┬────────────────┘
                          │
                    [Check files]
                    │  │  │
            ┌───────┘  │  └──────────┐
            │          │             │
            ↓          ↓             ↓
    [*.sln?   [package.json? [e2e/package.json?
     *.csproj?]  ]           ]
         ↓          ↓             ↓
      has_       has_         has_e2e
      dotnet   frontend       =true/false
      =true/    =true/
      false     false
         │          │             │
         └──────────┼─────────────┘
                    │
            [Output 3 flags]
                    │
         ┌──────────┼──────────┐
         │          │          │
         ↓          ↓          ↓
    [PARALLEL EXECUTION - Jobs 2, 3, 4]
    │          │          │
    ├─ If has_dotnet=true          ├─ If has_frontend=true       ├─ If has_e2e=true
    │  └─→ API-TESTS (Job 2)        │  └─→ FRONTEND-TESTS (Job 3) │  └─→ E2E-TESTS (Job 4)
    │     │                         │     │                        │     │
    │     ├─ Setup services         │     ├─ Setup Node.js 20.x   │     ├─ Setup Node.js
    │     │  ├─ PostgreSQL 16       │     ├─ npm ci               │     ├─ npm ci
    │     │  └─ Redis 7             │     ├─ npm lint            │     ├─ Playwright install
    │     │                         │     ├─ npm build           │     ├─ npm run test:e2e
    │     ├─ dotnet restore         │     ├─ npm test:unit       │     └─ Upload report
    │     ├─ dotnet build           │     └─ (continue on error)│
    │     ├─ EF migrations          │                            │
    │     ├─ dotnet test (JUnit)    │  [Result: [PASS] or [WARN]]       │  [Result: [PASS] or [FAIL]]
    │     └─ Upload artifacts       │                            │
    │                               │                            │
    │  [Result: [PASS] or [FAIL]]
    │
    └─ [All 3 await completion]
            │
            ↓
    ┌───────────────────────────┐
    │  SUMMARY (Job 5)          │
    │  (Final - Report Status)  │
    └───────────────────┬───────┘
                        │
           [Aggregate all job results]
                        │
                        ↓
                   ┌─────────┐
                   │ FINAL   │
                   │RESULT   │
                   ├─────────┤
                   │  [PASS] PASS│
                   │  [WARN] WARN│
                   │  [FAIL] FAIL│
                   └─────────┘
                        │
                        ↓
    [GitHub: Status check visible on PR/main]
```

---

## Detailed Security Gates Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│              SECURITY GATES WORKFLOW (security-gates.yml)        │
│  Triggered: Push/PR/Manual OR Schedule (Mon 03:00 UTC)         │
└──────────────────────────────────────────────────────────────────┘

                           START
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ↓                  ↓                  ↓
    [PR Event?]       [Manual Trigger?]    [Schedule/Push?]
      │                    │                    │
    [PASS] YES              [PASS] YES                [PASS] YES
      │                    │                    │
      └──────────────┬─────┴─────┬──────────────┘
                     │           │
         [PARALLEL EXECUTION - 4 Scanning Jobs]
         │           │           │           │
         ├─→ DEPENDENCY-REVIEW   ├─→ CODEQL  ├─→ SECRET-SCAN  ├─→ FILESYSTEM-SCAN
         │   (PR only)           │   (All)   │   (All)        │   (All)
         │   │                   │   │       │   │            │   │
         │   ├─ Check npm        │   ├─ JS/TS│   ├─ Gitleaks  │   ├─ Trivy fs scan
         │   ├─ Check NuGet      │   ├─ C#   │   ├─ Patterns: │   ├─ Config vuln
         │   ├─ FAIL on HIGH     │   ├─ Init │   │ - AWS keys │   ├─ Dep vulns
         │   └─ Exit code: 1 if  │   ├─ Scan │   │ - GitHub   │   ├─ Base image
         │      vuln found       │   ├─ Analyze   │   tokens  │   └─ CRITICAL+HIGH
         │                       │   └─ Upload  │   ├─ Private│       only
         │   [[TIME] 2-5 min]        │      SARIF    │   │   keys  │
         │                       │              │   └─ Upload │   [[TIME] 3-5 min]
         │                       │   [[TIME] 8-10 min]│   findings│
         │                       │              │            │
         │                       │              │   [[TIME] 2-3 min]
         │                       │              │
         └───────────────────┬──┴──────────────┴──────────────┘
                             │
            [All jobs complete (in parallel)]
                             │
            ┌────────────────┴────────────────┐
            │                                 │
            ↓                                 ↓
        ANY FAIL?                         ALL PASS?
         │                                 │
        [PASS] YES                            [PASS] YES
         │                                 │
         ↓                                 ↓
    [FAIL] Status: FAIL                    [PASS] Status: PASS
    ├─ Blocks merge (PR)              └─ Ready to deploy
    ├─ View findings:
    │  ├─ GitHub Security tab
    │  ├─ Code scanning alerts
    │  └─ Follow remediation
    │
    └─ Re-run after fix
         (Check failed job)


[RESULTS LOCATIONS]
├─ Dependency issues → GitHub Security → Code scanning
├─ CodeQL findings → GitHub Security → Code scanning
├─ Secrets detected → GitHub Secret scanning
└─ Filesystem vulns → GitHub Security → Code scanning
```

---

## Detailed GCP Deploy Workflow

```
┌────────────────────────────────────────────────────────────────────┐
│         GCP TERRAFORM DEPLOY WORKFLOW (gcp-terraform-deploy.yml)  │
│  Triggered: Manual dispatch OR Auto on iac file changes           │
└────────────────────────────────────────────────────────────────────┘

                    [MANUAL: Actions Tab]
                    [Select: env + operation]
                             │
                             ↓
                    ┌──────────────────┐
                    │ Manual Inputs    │
                    ├──────────────────┤
                    │ Environment:     │
                    │ ├─ dev           │
                    │ ├─ staging       │
                    │ └─ prod          │
                    │                  │
                    │ Operation:       │
                    │ ├─ plan (def)    │
                    │ └─ apply         │
                    │                  │
                    │ Cloud_run_image: │
                    │ └─ (optional)    │
                    └────────┬─────────┘
                             │
                             ↓
        ┌────────────────────────────────────────┐
        │ TERRAFORM Job (Single - Sequential)    │
        └────────┬───────────────────────────────┘
                 │
        [Step 1: Checkout]
                 │ Checkout repository code
                 ↓
        [Step 2: Setup Terraform]
                 │ Install Terraform CLI
                 ↓
        [Step 3: Authenticate to GCP]
                 │ OIDC workload identity
                 │ GitHub → GCP (no keys stored)
                 │ Token expires in 1 hour
                 ↓
        [Step 4: Setup gcloud SDK]
                 │ Cloud utilities
                 ↓
        [Step 5: Resolve Environment Files]
                 │ Read: environments/{env}/{env}.tfvars
                 │ Read: environments/{env}/backend.hcl
                 │ Validate: Files exist
                 │ Output: env, tfvars_file, backend_file
                 ↓
        [Step 6: Terraform Init]
                 │ Initialize working directory
                 │ Backend: GCS bucket (remote state)
                 │ Providers: Download plugins
                 │ Modules: Load submodules
                 ↓
        [Step 7: Format Check]
                 │ terraform fmt -check
                 │ Validate consistent style
                 ↓
        [Step 8: Validate Syntax]
                 │ terraform validate
                 │ Check: HCL syntax
                 │ Check: Module compatibility
                 ↓
        [Step 9: Terraform Plan]
                 │ terraform plan -out=tfplan
                 │ Input: tfvars (variables)
                 │ Input: Optional image override
                 │ Output: tfplan (binary)
                 │
                 │ Analysis:
                 │ ├─ (+) Create: VPC, Cloud SQL, Cloud Run, KMS, SM, OIDC
                 │ ├─ (~) Modify: (none expected)
                 │ └─ (-) Delete: (none expected)
                 │
                 ↓
        [Step 10: Upload Plan Artifact]
                 │ Store: tfplan file
                 │ Retention: 7 days
                 │ For: Audit trail + apply reference
                 ↓
        ┌─────────────────────────────┐
        │ Check: operation == apply?  │
        └─────────────┬───────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
        plan              apply
          │                       │
        STOP              ┌──────────────────┐
        (manual          │ Check: Approval? │
         re-run          └────────┬─────────┘
         needed for               │
         apply)          IF prod environment:
                         ├─ Requires 2+ approvals
                         │
                         ↓
                    [Approvers vote]
                         │
                    ┌────┴─────┐
                    │           │
              [PASS]APPROVED    [FAIL]REJECTED
                    │           │
                    ↓           ↓
            [Step 11: Apply] [STOP: Denied]
                    │
            terraform apply -input=false tfplan
                    │
         [Create/Modify GCP Resources]
                    │
            ├─ VPC Network created
            ├─ Cloud SQL PostgreSQL instance created
            ├─ Cloud KMS keys created
            ├─ Secret Manager secrets created
            ├─ Cloud Run service created
            ├─ OIDC Workload Identity configured
            └─ Output: Resource IDs, endpoints
                    │
                    ↓
            ┌──────────────────┐
            │ COMPLETE [PASS]      │
            │ Infrastructure   │
            │ deployed to GCP  │
            └──────────────────┘

[RESULT MATRIX]
┌─────────────────────────────────────────────────────────────┐
│ Scenario                │ Result                │ Next Action│
├─────────────────────────────────────────────────────────────┤
│ Validate/Init fails     │ [FAIL] FAIL (early)      │ Fix config │
│ Plan shows errors       │ [FAIL] FAIL             │ Fix Terraform
│ Plan shows correct      │ [PASS] PASS (plan)      │ Review &   │
│   resources             │                     │ manually   │
│                         │                     │ trigger    │
│ Apply approved          │ [PASS] PASS (deploy)    │ Monitor in │
│                         │                     │ GCP        │
│ Apply rejected (prod)   │ [WARN] HALTED           │ Get approval
└─────────────────────────────────────────────────────────────┘
```

---

## Legend

```
┌─ Symbols ─────────────────────────────────┐
│ [PASS] = Success / Approved / Yes              │
│ [FAIL] = Failed / Rejected / No                │
│ [WARN]  = Warning / Approval Needed            │
│ ↓  = Flow / Next step                      │
│ →  = Conditional branch                    │
│ ├─ = List item                             │
│ └─ = List end                              │
│ [TIME]  = Time estimate                        │
└────────────────────────────────────────────┘
```

---

**Last Updated:** 2026-04-22

