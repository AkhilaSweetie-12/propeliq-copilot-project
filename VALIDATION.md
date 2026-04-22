# PropelIQ-Copilot Project Validation Checklist

Last Updated: 2026-04-22
Environment: Development

---

## 1. Repository & Git State Validation

### 1.1 Git Status
```bash
# Check git status
cd d:\kanini\PropelIQ-Copilot-project
git status

# Expected: No uncommitted changes in core files (warnings OK for untracked workflow artifacts)
```

**Checklist:**
- [ ] Repository initialized (`.git` folder exists)
- [ ] No merge conflicts in tracked files
- [ ] Remote URL configured (`git remote -v`)
- [ ] Current branch is main or develop
- [ ] No uncommitted changes in `.github/`, `.propel/context/docs/`, or `README.md`

### 1.2 Project Structure
```bash
# Verify directory structure
ls -R d:\kanini\PropelIQ-Copilot-project | head -50
```

**Expected Structure:**
```
d:\kanini\PropelIQ-Copilot-project/
├── .env                           # Environment variables (MUST exist, MUST be gitignored)
├── .env.example                   # Template
├── .git/                          # Git repository
├── .github/
│   ├── agents/                    # MCP agents
│   ├── instructions/              # Development standards (40+ instruction files)
│   ├── prompts/                   # Workflow prompts
│   └── workflows/
│       └── gcp-terraform-deploy.yml  # Active deployment workflow
├── .propel/
│   ├── context/
│   │   ├── docs/                  # Generated specification documents
│   │   ├── iac/                   # Infrastructure-as-Code (GCP Terraform)
│   │   ├── pipelines/             # CI/CD pipeline templates
│   │   ├── tasks/                 # User story & task decompositions
│   │   └── wireframes/            # UI/UX wireframes (HTML + CSS)
│   ├── orchestrators/             # Agentic workflow orchestrators
│   ├── prompts/                   # MCP prompt definitions
│   ├── rules/                     # Development standards rules
│   └── templates/                 # Code generation templates
├── .vscode/
│   └── settings.json              # VS Code MCP configuration
├── brd.md                         # Business Requirements Document
├── README.md                      # Main project documentation
└── VALIDATION.md                  # This file
```

**Validation:**
- [ ] `.env` file exists and is in `.gitignore`
- [ ] `.github/workflows/` contains at least 1 workflow file
- [ ] `.propel/context/docs/` contains spec.md, design.md, figma_spec.md
- [ ] `.propel/context/iac/gcp/terraform/` contains Terraform modules
- [ ] `.propel/context/tasks/` contains user story directories (EP-00X/us_XXX/)

---

## 2. Configuration Files Validation

### 2.1 Environment Configuration
```bash
# Check .env file
cat d:\kanini\PropelIQ-Copilot-project\.env

# Check .gitignore
grep -E "^\.env|^\.github|\.propel/templates" d:\kanini\PropelIQ-Copilot-project\.gitignore
```

**Checklist:**
- [ ] `.env` file exists with required variables (if any)
- [ ] `.gitignore` includes: `.env`, `.github/*` (if local-only), `.propel/templates/*`
- [ ] No API keys or secrets in `.env.example`

### 2.2 VS Code Configuration
```bash
# Verify MCP configuration
test -f d:\kanini\PropelIQ-Copilot-project\.vscode\settings.json && echo "✓ Found" || echo "✗ Missing"
```

**Checklist:**
- [ ] `.vscode/settings.json` exists
- [ ] MCP server references are valid (if configured)

---

## 3. GitHub Actions Workflow Validation

### 3.1 Workflow Files
```bash
# List all workflows
ls -la d:\kanini\PropelIQ-Copilot-project\.github\workflows\*.yml
```

**Expected Workflows:**
- [ ] `gcp-terraform-deploy.yml` exists
  - [ ] Contains `env:` for GCP project and service account
  - [ ] Has `on: [workflow_dispatch, push]` triggers
  - [ ] Defines `inputs` for `environment`, `operation`, optional `cloud_run_image`
  - [ ] Uses `OIDC` for GitHub → GCP authentication
  - [ ] Runs `terraform init`, `fmt -check`, `validate`, `plan` steps

### 3.2 Workflow Secrets
```bash
# In GitHub repo settings, verify these secrets exist:
# Secrets → Actions secrets
```

**Required Secrets (GitHub repo settings):**
- [ ] `GCP_WORKLOAD_IDENTITY_PROVIDER` — Full resource name of OIDC provider
- [ ] `GCP_TERRAFORM_SERVICE_ACCOUNT` — Service account email for Terraform

### 3.3 GitHub Environments
```bash
# Check GitHub repo settings → Environments
```

**Expected Environments:**
- [ ] `dev` environment exists (no approval required, OK for testing)
- [ ] `staging` environment exists (recommended: requires approval)
- [ ] `prod` environment exists (required: 1+ approval before deploy)

---

## 4. Infrastructure-as-Code (IaC) Validation

### 4.1 Terraform Module Structure
```bash
# Verify GCP Terraform structure
find d:\kanini\PropelIQ-Copilot-project\.propel\context\iac\gcp\terraform -type f -name "*.tf" | sort
```

**Expected Files:**
```
.propel/context/iac/gcp/terraform/
├── backend.tf              # Backend config template
├── main.tf                 # Root module resources
├── providers.tf            # Provider configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── modules/
│   └── platform/
│       ├── main.tf         # Platform module resources
│       ├── variables.tf    # Module variables
│       └── outputs.tf      # Module outputs
└── environments/
    ├── dev/
    │   ├── backend.hcl     # Dev backend config
    │   └── dev.tfvars      # Dev variable values
    ├── staging/
    │   ├── backend.hcl
    │   └── staging.tfvars
    └── prod/
        ├── backend.hcl
        └── prod.tfvars
```

**Checklist:**
- [ ] All expected `.tf` files present
- [ ] Backend files use placeholders (e.g., `<GCP_PROJECT>`, `<TERRAFORM_BUCKET>`)
- [ ] Each environment has `backend.hcl` and `*.tfvars`
- [ ] `providers.tf` specifies GCP provider with correct version constraint

### 4.2 Terraform Validation
```bash
# From within terraform directory
cd d:\kanini\PropelIQ-Copilot-project\.propel\context\iac\gcp\terraform

# Validate syntax (requires Terraform CLI)
terraform init -backend=false
terraform validate
terraform fmt -check
```

**Checklist:**
- [ ] `terraform validate` passes (no syntax errors)
- [ ] `terraform fmt -check` passes (consistent formatting)
- [ ] No hard-coded credentials in any `.tf` file
- [ ] All variable references resolved in `*.tfvars`

---

## 5. Documentation Validation

### 5.1 Specification Documents
```bash
# List generated docs
ls -lh d:\kanini\PropelIQ-Copilot-project\.propel\context\docs\
```

**Required Files:**
- [ ] `spec.md` — Functional requirements, use cases (FR-XXX, UC-XXX)
- [ ] `design.md` — Non-functional requirements, architecture (NFR-XXX, TR-XXX)
- [ ] `figma_spec.md` — Screen specifications, UX requirements (UXR-XXX)
- [ ] `designsystem.md` — Design tokens, typography, spacing, colors
- [ ] `epics.md` — Epic backlog (EP-XXX mapped to requirements)
- [ ] `models.md` — UML diagrams (ER, sequence, component, deployment)

### 5.2 Content Validation
```bash
# Check for required markers
grep -c "^# " d:\kanini\PropelIQ-Copilot-project\.propel\context\docs\spec.md
grep -c "^## " d:\kanini\PropelIQ-Copilot-project\.propel\context\docs\figma_spec.md
```

**Checklist (per document):**
- [ ] Headings use markdown levels (H1 `#`, H2 `##`, etc.)
- [ ] Tables properly formatted with pipes and dashes
- [ ] Code blocks use triple backticks with language identifier
- [ ] Requirement IDs present (FR-XXX, UC-XXX, UXR-XXX, EP-XXX)
- [ ] Traceability links included where applicable

---

## 6. User Stories & Tasks Validation

### 6.1 Story Structure
```bash
# List user stories
ls d:\kanini\PropelIQ-Copilot-project\.propel\context\tasks\
```

**Expected Directory Structure:**
```
.propel/context/tasks/
├── EP-001/us_001/
│   ├── us_001.md            # User story definition
│   ├── task_001_*.md        # Task decomposition
│   └── task_002_*.md        # Task decomposition
├── EP-002/us_024/
│   ├── us_024.md
│   ├── task_001_*.md
│   └── ...
└── EP-003/us_026/
    ├── us_026.md
    ├── task_001_*.md
    └── ...
```

### 6.2 Story Content
```bash
# Verify story file format
head -20 d:\kanini\PropelIQ-Copilot-project\.propel\context\tasks\EP-001\us_001\us_001.md
```

**Checklist (per user story file):**
- [ ] YAML frontmatter present (title, epic, story_id, status)
- [ ] Description section included
- [ ] Acceptance Criteria (numbered 1-5+)
- [ ] Edge Cases documented
- [ ] Traceability section with parent epic and requirement tags
- [ ] Dependencies listed
- [ ] Effort estimation (story points, hours, complexity)
- [ ] Screen references for UI stories (SCR-XXX)

### 6.3 Task Content
```bash
# Sample task file check
head -30 d:\kanini\PropelIQ-Copilot-project\.propel\context\tasks\EP-001\us_001\task_001_*.md
```

**Checklist (per task file):**
- [ ] YAML frontmatter with task_id, story_id, layer (Frontend/Backend/Database)
- [ ] Requirement Reference section linking to user story
- [ ] Implementation Plan with numbered steps
- [ ] Impacted Components listed with Action (CREATE/MODIFY/DELETE)
- [ ] Build Commands section
- [ ] Implementation Validation Strategy with checkboxes
- [ ] Implementation Checklist with actionable items

---

## 7. Wireframes & UI Artifacts Validation

### 7.1 Wireframe Files
```bash
# List generated wireframes
ls d:\kanini\PropelIQ-Copilot-project\.propel\context\wireframes\Hi-Fi\*.html | wc -l
```

**Expected Count:**
- [ ] At least 18+ HTML wireframe files (one per major screen: SCR-001–SCR-021)
- [ ] Filename pattern: `wireframe-SCR-XXX-{screen-name}.html`
- [ ] Associated CSS file: `wireframe-shared.css`

### 7.2 Wireframe Content
```bash
# Spot-check a wireframe
head -50 d:\kanini\PropelIQ-Copilot-project\.propel\context\wireframes\Hi-Fi\wireframe-SCR-001-login.html
```

**Checklist (per wireframe):**
- [ ] HTML5 doctype present
- [ ] Linked CSS stylesheet (`wireframe-shared.css`)
- [ ] Semantic HTML structure (form labels, buttons, inputs)
- [ ] Data attributes for testing (`data-testid`, `data-screen-id`)
- [ ] ARIA attributes for accessibility (`aria-label`, `aria-required`, `role`)
- [ ] Responsive meta viewport tag
- [ ] No hard-coded inline styles (defer to CSS classes)

### 7.3 Design System Compliance
```bash
# Verify design tokens are referenced
grep -c "color-brand-navy\|text-h1\|space-4" d:\kanini\PropelIQ-Copilot-project\.propel\context\wireframes\wireframe-shared.css
```

**Checklist:**
- [ ] CSS uses design tokens (custom properties like `--color-brand-navy`, `--space-4`)
- [ ] No hard-coded colour values like `#1E3A5F` in CSS
- [ ] Responsive breakpoints defined (320px, 768px, 1024px)
- [ ] Consistent spacing (4px base unit grid)
- [ ] Typography follows design system (font families, sizes, weights)

---

## 8. Code Quality & Standards Validation

### 8.1 Instruction Files
```bash
# Count instruction files
ls d:\kanini\PropelIQ-Copilot-project\.github\instructions\*.instructions.md | wc -l
```

**Expected:**
- [ ] 40+ instruction files covering all tech stacks and standards
- [ ] Files follow naming convention: `{topic}-standards.instructions.md`

### 8.2 Prompt Files
```bash
# List prompt files
ls d:\kanini\PropelIQ-Copilot-project\.github\prompts\*.prompt.md | head -10
```

**Checklist:**
- [ ] Prompt files reference external MCP sources or local workflow definitions
- [ ] Each prompt has clear `applyTo` field specifying file patterns
- [ ] Prompts cover key workflows: create-spec, create-iac, create-pipeline-scripts, create-figma-spec

---

## 9. README & Documentation Validation

### 9.1 README Content
```bash
# Check README sections
grep "^## " d:\kanini\PropelIQ-Copilot-project\README.md
```

**Expected Sections:**
- [ ] Executive Summary
- [ ] Setup (with prerequisites, installation steps, verification)
- [ ] GCP Deployment Pipeline (if infrastructure present)
- [ ] Prompts (table of available workflows)
- [ ] Agentic Orchestrators (if defined)
- [ ] Instructions (standards & guidelines)

### 9.2 Setup Verification
```bash
# Verify setup instructions are accurate
cat d:\kanini\PropelIQ-Copilot-project\README.md | grep -A 20 "^## Setup"
```

**Checklist:**
- [ ] Prerequisites listed (VS Code, Node.js, API key)
- [ ] Step-by-step installation instructions clear
- [ ] Configuration examples provided
- [ ] Verification steps documented (how to confirm setup worked)

---

## 10. Security & Compliance Validation

### 10.1 Secrets & Credentials
```bash
# Scan for exposed secrets (basic check)
grep -r "PRIVATE KEY\|password\|secret" d:\kanini\PropelIQ-Copilot-project\*.tf d:\kanini\PropelIQ-Copilot-project\.env 2>/dev/null | grep -v "^Binary"
```

**Checklist:**
- [ ] No hardcoded credentials in `.tf`, `.yml`, `.md` files
- [ ] `.env` file is gitignored
- [ ] GitHub Secrets are used for sensitive values (`GCP_WORKLOAD_IDENTITY_PROVIDER`, etc.)
- [ ] All credentials use placeholder format (e.g., `<PROJECT_ID>`, `${GCP_PROJECT}`)

### 10.2 Access Control
```bash
# Verify GitHub repo access rules
# Check GitHub → Settings → Collaborators & Teams
```

**Checklist:**
- [ ] Appropriate branch protection rules (require PRs, status checks)
- [ ] Dismiss stale reviews on new commits enabled
- [ ] Require approvals for prod/main branch enabled
- [ ] Team/role-based access configured

### 10.3 Terraform State Security
```bash
# Verify Terraform backend config
cat d:\kanini\PropelIQ-Copilot-project\.propel\context\iac\gcp\terraform\environments\dev\backend.hcl
```

**Checklist:**
- [ ] Backend uses remote storage (GCS, S3, etc.), not local
- [ ] Backend includes `encrypt = true` (if supported)
- [ ] State file access restricted to service account only
- [ ] Backend bucket versioning enabled
- [ ] State locking configured (if applicable)

---

## 11. Quick Validation Scripts

### 11.1 One-Line Health Check
```bash
# Run this to get a quick status report
cd d:\kanini\PropelIQ-Copilot-project && \
echo "=== Git Status ===" && git status --short && \
echo -e "\n=== Directory Structure ===" && \
test -d .github/workflows && echo "✓ Workflows found" || echo "✗ Workflows missing" && \
test -d .propel/context/docs && echo "✓ Docs found" || echo "✗ Docs missing" && \
test -d .propel/context/iac && echo "✓ IaC found" || echo "✗ IaC missing" && \
test -d .propel/context/tasks && echo "✓ Tasks found" || echo "✗ Tasks missing" && \
echo -e "\n=== Workflow Files ===" && ls -1 .github/workflows/*.yml 2>/dev/null | wc -l && \
echo -e "\n=== Environment Files ===" && \
test -f .env && echo "✓ .env exists" || echo "✗ .env missing" && \
test -f .env.example && echo "✓ .env.example exists" || echo "✗ .env.example missing"
```

### 11.2 Documentation Completeness Check
```bash
# Verify all critical docs exist
cd d:\kanini\PropelIQ-Copilot-project\.propel\context\docs && \
for doc in spec.md design.md figma_spec.md designsystem.md epics.md models.md; do \
  test -f "$doc" && echo "✓ $doc" || echo "✗ $doc MISSING"; \
done
```

### 11.3 Terraform Syntax Check (if Terraform CLI installed)
```bash
# Validate Terraform syntax
cd d:\kanini\PropelIQ-Copilot-project\.propel\context\iac\gcp\terraform && \
terraform init -backend=false && \
terraform validate && \
terraform fmt -check && \
echo "✓ All Terraform files valid" || echo "✗ Terraform validation failed"
```

---

## 12. Summary: Validation Scorecard

Use this checklist to calculate your project validation score:

| Category | Max Points | Your Score |
|----------|-----------|-----------|
| Repository & Git State | 5 | _ |
| Project Structure | 5 | _ |
| Configuration Files | 5 | _ |
| GitHub Actions Workflows | 5 | _ |
| Infrastructure-as-Code | 10 | _ |
| Documentation Completeness | 15 | _ |
| User Stories & Tasks | 15 | _ |
| Wireframes & UI Artifacts | 10 | _ |
| Code Quality & Standards | 5 | _ |
| Security & Compliance | 10 | _ |
| **TOTAL** | **80** | **_** |

**Scoring Guide:**
- **70–80**: ✓ Ready for development — all critical artifacts present
- **50–69**: ⚠ Partial readiness — some key artifacts missing, safe to proceed with caution
- **< 50**: ✗ Not ready — major gaps; run quickfix tasks before proceeding

---

## 13. Next Steps After Validation

### If Score ≥ 70
1. [ ] Commit all validated artifacts to main branch
2. [ ] Tag release: `git tag -a v1.0.0-alpha -m "Initial project scaffold"`
3. [ ] Push: `git push origin main --tags`
4. [ ] Begin feature development: `/build-feature-agent us_001`

### If Score 50–69
1. [ ] Identify missing artifacts from checklist
2. [ ] Use appropriate orchestrators to generate missing docs/tasks
3. [ ] Re-run validation
4. [ ] Once ≥ 70, proceed to deployment phase

### If Score < 50
1. [ ] Run discovery phase: `/discovery-agent brd.md`
2. [ ] Generate backlog: `/backlog-agent`
3. [ ] Revalidate
4. [ ] Contact team lead if blockers remain

---

## References

- **CI/CD Pipeline Docs**: `.propel/context/pipelines/README.md`
- **IaC Docs**: `.propel/context/iac/README.md`
- **Specification Docs**: `.propel/context/docs/*.md`
- **Project README**: `README.md` (main)
- **Git Configuration**: `.github/` directory

---

Generated: 2026-04-22 | Updated by: Copilot
