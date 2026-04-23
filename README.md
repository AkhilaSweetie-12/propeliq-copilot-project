# PropelIQ-Copilot

## Executive Summary

PropelIQ-Copilot is an AI-powered development framework that automates software development workflows from requirements gathering to implementation. It provides structured workflows for generating specifications, user stories, tasks, and code while enforcing comprehensive development standards across multiple languages and frameworks. The system combines business analysis, architecture design, and quality assurance into a unified platform for rapid, high-quality software delivery.

## Setup

PropelIQ-Copilot requires initial configuration to integrate with your project and enable AI-powered workflow automation. This setup process configures the framework files, API credentials, and MCP server integrations necessary for full functionality.

### Prerequisites

Before beginning setup, ensure you have:
- VS Code installed on your system
- Node.js and npm (required for MCP server integrations)
- Context7 API key (obtain from [Context7](https://context7.com))

### Installation Steps

#### Step 1: Copy Framework Files

Copy the following directories and files to your project root:
- `.github/` - Contains prompt definitions and development instructions
- `.propel/` - Contains templates and project artifacts
- `.vscode/` - Contains MCP configuration
- `.env-example` - Environment variable template

#### Step 2: Configure Environment Variables

1. Rename `.env-example` to `.env` in your project root
2. Open the `.env` file and replace the placeholder with your actual Context7 API key:

```bash
CONTEXT7_API_KEY=your-actual-api-key-here
```

#### Step 3: Configure Source Control

Add the following entries to your project's `.gitignore` file to prevent committing sensitive configuration:

```gitignore
# PropelIQ-Copilot Framework
.env
.github/*
.propel/templates/*
.vscode/mcp.json
```

This ensures API keys and framework-specific files remain local to your development environment.

#### Step 4: Verify Installation

1. Open "Chat" by pressing `Ctrl + Alt + I`
2. Type `\` (backslash) to view available prompts
3. Confirm that all workflows from `.github/prompts/` appear in the list

If commands are visible, your setup is complete and PropelIQ-Copilot is ready to use.

## Quick Start

**New to this project?** Start here:

- [REFERENCE] [QUICKSTART.md](QUICKSTART.md) — Get running in 5 minutes (local services)
- [LAUNCH] [GCP_SETUP.md](GCP_SETUP.md) — Deploy to Google Cloud Platform
- [DONE] [VALIDATION.md](VALIDATION.md) — Validate project completeness

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm
- .NET 8 SDK
- Git Bash or PowerShell

### 1. Navigate to Project Root

```bash
cd /d/kanini/PropelIQ-Copilot-project
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd src/frontend

# Install dependencies (use npm install instead of npm ci for first time)
npm install

# Run tests
npm test -- --coverage --watchAll=false

# Build application
npm run build

# Go back to root
cd ../..
```

### 3. Backend Setup

```bash
# Navigate to backend directory
cd src/backend

# Restore dependencies (specify which project)
dotnet restore PropelIQ.API.csproj

# Run tests (specify test project)
dotnet test PropelIQ.API.Tests.csproj --configuration Release

# Build application (specify main project)
dotnet build PropelIQ.API.csproj --configuration Release

# Go back to root
cd ../..
```

### 4. Make Scripts Executable

```bash
# Verify scripts exist
ls scripts/*.sh

# Make scripts executable
chmod +x scripts/deploy.sh
chmod +x scripts/setup-gcp.sh
```

### 5. Run Applications Locally

```bash
# Frontend (React) - runs on http://localhost:5173
cd src/frontend
npm run dev

# Backend (.NET API) - runs on https://localhost:7000 or http://localhost:5000
cd src/backend
dotnet run
```

### 6. Install Dependencies in Root Directory

```bash
# If npm install fails in frontend, try from root
cd src/frontend
npm install --legacy-peer-deps
cd ../..

# For backend, ensure you're in the right directory
cd src/backend
dotnet restore PropelIQ.API.csproj
cd ../..
```

### 7. Clear Caches (If Needed)

```bash
# Clear npm cache if needed
cd src/frontend
npm cache clean --force
rm package-lock.json
npm install
cd ../..

# Clear dotnet cache if needed
cd src/backend && dotnet clean PropelIQ.API.csproj && dotnet restore PropelIQ.API.csproj && cd ../..
```

### 8. Complete Setup Commands (Tested)

```bash
# Complete backend setup (solution file approach - most reliable)
cd src/backend && dotnet restore && dotnet test PropelIQ.API.sln --configuration Release && dotnet build PropelIQ.API.sln --configuration Release && cd ../..

# Frontend setup (may need troubleshooting)
cd src/frontend && npm install && npm run build && cd ../..
```

### 9. Run Tests Individually

```bash
# Frontend tests (may fail but build works)
cd src/frontend
npm test
cd ../..

# Backend tests (solution file approach - most reliable)
cd src/backend
dotnet test PropelIQ.API.sln --configuration Release
cd ../..
```

### 10. Run Applications Locally

```bash
# Terminal 1: Backend
cd src/backend && dotnet run

# Terminal 2: Frontend  
cd src/frontend && npm run dev
```

### 11. Test Docker Builds (Optional)

> **Note**: Docker is optional for local development. Applications run fine without Docker Desktop.

```bash
# Test frontend Docker build (requires Docker Desktop)
cd src/frontend
docker build -t propeliq-frontend-test .
cd ../..

# Test backend Docker build (requires Docker Desktop)
docker build -t propeliq-backend-test .
```

### 12. Verify Setup

- ✅ Frontend builds successfully
- ✅ Backend builds successfully  
- ✅ All tests pass
- ✅ Applications run locally
- ✅ Scripts are executable
- ⚠️ Docker builds (optional, requires Docker Desktop)

### Troubleshooting

- **Multiple project files error**: Use solution file `PropelIQ.API.sln` instead of individual .csproj files
- **npm ci fails**: Use `npm install` for first-time setup
- **Frontend Jest test failures**: Jest cannot parse ES modules/TypeScript - use `npm run build` instead
- **MSBuild project file error**: Use solution file approach `dotnet test PropelIQ.API.sln --configuration Release`
- **Backend dotnet test inconsistency**: Solution file is more reliable than individual project files
- **Docker not required**: Local development works without Docker Desktop
- **Docker connection errors**: Install and start Docker Desktop, or skip Docker steps

## Active CI/CD Workflows

This repository includes three active GitHub Actions workflows:

### 1. Continuous Integration (`ci.yml`)
- **Triggers**: PR to main, push to main, manual dispatch
- **Jobs**: Stack detection, API tests (.NET), Frontend tests (Node), E2E tests (Playwright)
- **Status**: Runs on every commit to main branch

### 2. Security Gates (`security-gates.yml`)
- **Triggers**: PR to main, push to main, weekly schedule, manual dispatch
- **Scans**: Dependency review, CodeQL analysis, secret scanning (Gitleaks), filesystem scanning (Trivy)
- **Status**: Detects vulnerabilities and security issues

### 3. GCP Infrastructure Deployment (`gcp-terraform-deploy.yml`)
- **Triggers**: Manual dispatch from Actions tab
- **Operations**: `plan` (dry-run) or `apply` (deploy)
- **Environments**: dev, staging, prod with approval gates
- **Infrastructure**: VPC, Cloud SQL, Cloud Run, KMS, Secret Manager, OIDC workload identity
- **Status**: Ready for use after GCP/GitHub setup

## GCP Deployment

### Prerequisites

Before deploying to GCP, complete these steps:

1. **[Read GCP_SETUP.md](GCP_SETUP.md)** — Complete Phase 1 (GCP Project Setup)
   - Create GCP project and enable APIs
   - Create Terraform backend bucket (GCS)
   - Set up service account and Workload Identity Federation

2. **Update Terraform Configuration** — Complete Phase 2 (GCP_SETUP.md)
   - Set GCP project ID, region, and resource names in `terraform.tfvars`
   - Configure backend state bucket in `backend.hcl`

3. **Configure GitHub Secrets** — Complete Phase 3 (GCP_SETUP.md)
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` (from Workload Identity setup)
   - `GCP_TERRAFORM_SERVICE_ACCOUNT` (service account email)
   - `TERRAFORM_BUCKET` (GCS bucket name)
   - `CI_JWT_SIGNING_KEY` (for CI test environment)

### First Deployment

1. Go to **GitHub → Actions → GCP Terraform Deploy**
2. Click **Run workflow**
3. Select `environment=dev`, `operation=plan`
4. Review terraform plan output
5. If successful, run again with `operation=apply`

### Environments

| Environment | Approval Required | Auto-deploy | Use Case |
|-------------|------------------|-------------|----------|
| dev | No | Manual | Development & testing |
| staging | Yes (1 reviewer) | Manual | Pre-production validation |
| prod | Yes (2+ reviewers) | Manual | Production deployment |

See [GCP_SETUP.md Phase 4](GCP_SETUP.md#phase-4-first-deployment-test) for detailed deployment walkthrough.

## Infrastructure Components

The Terraform configuration deploys:

- **VPC Network** — Private VPC with Cloud SQL private IP networking
- **Cloud SQL** — PostgreSQL 16 with pgvector extension
- **Cloud Run** — ASP.NET Core API with auto-scaling
- **Cloud KMS** — Data encryption keys for sensitive fields
- **Secret Manager** — Secure storage for API keys and credentials
- **OIDC Workload Identity** — GitHub Actions authentication without long-lived keys

## Prompts

| Prompt | Description | Input | Output | Usage Example |
|----------|-------------|-------|--------|---------------|
| `analyze-codebase` | Entry point for comprehensive codebase analysis with architectural insights and strategic recommendations | Repository URL, folder path, technology stack, business domain (optional) | `.propel/context/docs/codeanalysis.md` | `/analyze-codebase` |
| `analyze-implementation` | Reviews completed code changes against task requirements for scope alignment and quality assessment | Task file path | `.propel/context/tasks/us_XXX/reviews/task-review-<task-id>.md`, console output | `/analyze-implementation .propel/context/tasks/task_001/task_001.md` |
| `analyze-ux` | UI/UX analysis via Playwright for visual consistency, accessibility, and responsiveness. | Task file path (recommended), or server URL with app path | `.propel/context/tasks/us_XXX/reviews/ui-review-<task-id>.md` | `/analyze-ux .propel/context/tasks/us_001/task_001.md` |
| `build-prototype` | Transforms business hypotheses into working validation prototypes within 80 hours with priority-based scoping | Business hypothesis, feature idea, problem statement | Working prototype code | `/build-prototype "E-commerce checkout flow"` |
| `create-automation-test` | Decomposes functional requirements into feature-level and E2E test workflow specifications for Playwright automation | spec.md, feature name, or UC-XXX (optional), --type flag | `.propel/context/test/tw_<feature>.md`, `.propel/context/test/e2e_<journey>.md` | `/create-automation-test --type feature` |
| `create-epics` | Generates EP-XXX epics with requirement mappings, priorities, business value. | File path to requirements document, free text epic scope (optional) | `.propel/context/docs/epics.md` | `/create-epics spec.md` |
| `create-project-plan` | Generates project plan with scope, milestones, AI-adjusted cost baseline, auto-derived team composition, and risk register from discovery phase outputs | spec.md (required), design.md (required), `--start-date`, `--buffer` flags (optional) | `.propel/context/docs/project_plan.md` | `/create-project-plan` |
| `create-figma-spec` | Derives screens from requirements, creates screen specifications with state requirements, flows, and design tokens | Path to spec.md file (optional) | `.propel/context/docs/figma_spec.md`, `.propel/context/docs/designsystem.md` | `/create-figma-spec` |
| `create-iac` | Generates Terraform modules for multi-cloud providers from infrastructure specification | infra-spec.md, --provider flag | `.propel/context/iac/<provider>/terraform/` | `/create-iac --provider <cloud>` |
| `create-pipeline-scripts` | Generates GitHub Actions workflow files from CI/CD specification | cicd-spec.md, --platform flag | `.propel/context/pipelines/github-actions/` | `/create-pipeline-scripts` |
| `create-spec` | Generates functional requirements (FR-XXX) and Use Case specifications with PlantUML diagrams | Feature specifications, business requirements, project scope documents (.pdf, .txt, .md, .docx) | `.propel/context/docs/spec.md` | `/create-spec project-scope.md` |
| `create-sprint-plan` | Generates sprint plans with dependency-ordered story allocation, sprint goals, capacity planning, and critical path analysis | epics.md (required), us_*.md (required), project_plan.md (recommended), EP-XXX filter, `--sprint-duration`, `--velocity`, `--buffer` flags (optional) | `.propel/context/docs/sprint_plan.md` | `/create-sprint-plan` |
| `create-test-plan` | Generates comprehensive E2E test plans from spec.md and design.md with full requirement traceability | spec.md, design.md, feature name (optional), --scope flag | `.propel/context/docs/test_plan_[feature].md` | `/create-test-plan --scope full` |
| `create-user-stories` | Generates INVEST-compliant user stories with acceptance criteria, effort estimation, and Visual Design Context section | Scope file path, Epic ID, feature text, or epic URL | `.propel/context/tasks/us_XXX/us_XXX.md` | `/create-user-stories scope.md EP-001` |
| `design-architecture` | Generates comprehensive design documents including NFR, TR, DR requirements and architecture patterns | Feature file path (optional) | `.propel/context/docs/design.md` | `/design-architecture .propel/context/docs/spec.md` |
| `design-model` | Generates UML architectural diagrams including conceptual, component, deployment, data flow, ERD, and sequence diagrams | Path to spec.md or codeanalysis.md (optional) | `.propel/context/docs/models.md` | `/design-model spec.md` |
| `generate-figma` | Transforms screen specifications into production-ready Figma structures with component libraries and clickable prototypes | figma_spec.md, designsystem.md | Figma artifacts and JPG exports | `/generate-figma` |
| `generate-playwright-scripts` | Generates production-ready Playwright TypeScript scripts from test workflow specifications | tw_*.md or e2e_*.md file(s), --type flag | `test-automation/tests/*.spec.ts`, `test-automation/e2e/*.spec.ts`, `test-automation/pages/*.page.ts` | `/generate-playwright-scripts` |
| `generate-wireframe` | Generates wireframe with SCR-XXX traceability, navigation map, and UXR coverage validation. | figma_spec.md (primary), fidelity level (low/high), `--generate-wireframes` flag | `.propel/context/wireframes/[Lo-Fi\|Hi-Fi]/wireframe-SCR-XXX-{name}.html`, `navigation-map.md` | `/generate-wireframe --fidelity=high` |
| `implement-tasks` | Implements features, fixes bugs, and completes development tasks with systematic validation | Task file path(s), `--skip-history` (optional) | Implementation code | `/implement-tasks .propel/context/tasks/us_001/task_001.md` |
| `plan-bug-resolution` | Performs comprehensive bug triage, root cause analysis, and generates fix implementation tasks | Bug report file, URL, issue description, or error log, `--skip-history` (optional) | `.propel/context/tasks/bug_XXX/` | `/plan-bug-resolution bug-report.md` |
| `plan-cicd-pipeline` | Designs CI/CD pipeline architecture with CICD-XXX requirements and security gates | design.md, spec.md, --platform flag | `.propel/context/devops/cicd-spec.md` | `/plan-cicd-pipeline` |
| `plan-cloud-infrastructure` | Generates infrastructure specification with INFRA-XXX, SEC-XXX requirements from design.md | design.md, spec.md (optional), --cloud-provider flag | `.propel/context/devops/infra-spec.md` | `/plan-cloud-infrastructure` |
| `plan-development-tasks` | Generates implementation tasks from feature requirements with context integration | User story file path, URL, text, or feature requirements, `--skip-history` (optional) | `.propel/context/tasks/us_XXX/task_*.md` | `/plan-development-tasks .propel/context/tasks/us_001/us_001.md` |
| `plan-unit-tests` | Generates comprehensive unit test plans from user story specifications with test coverage analysis | User story file path, ID, URL, or text | `.propel/context/tasks/us_XXX/unittest/` | `/plan-unittest us_001` |
| `pull-request` | Pull request creation with comprehensive validation, conflict detection, and platform support (GitHub/Azure DevOps) | Platform, title, description (optional) | Pull request on configured platform | `/pull-request feature/auth main "Add OAuth2 authentication"` |
| `review-code` | Comprehensive code review with technology-specific analysis, static analysis, and architectural assessment | File path(s) or local changes (git diff), `--skip-history` (optional) | `.propel/code-reviews/review_<timestamp>.md`, `.propel/learnings/findings-registry.md` | `/review-code --file src/UserService.cs` or `/review-code` |
| `review-devops-security` | Mandatory security gate reviewing IaC and pipelines for compliance | infra-spec.md, cicd-spec.md, generated artifacts | `.propel/context/devops/security-reviews/review_*.md` | `/review-devops-security` |

## Agentic Orchestrators

Agentic orchestrators automate multi-step workflows by sequentially invoking individual workflows, managing conditional branching, and providing unified progress tracking. Each orchestrator targets a specific phase of the development lifecycle.

| Orchestrator | Description | Handoff | Usage Example |
|--------------|-------------|---------|---------------|
| `discovery-agent` | Orchestrates technical discovery: `create-spec` → `design-architecture` → `design-model` → `create-figma-spec` [if UI] → `create-test-plan` | `/backlog-agent` | `/discovery-agent Project_Scope.md` |
| `backlog-agent` | Transforms specs into backlog: `create-epics` → `generate-wireframe` [optional] → `create-user-stories` | `/build-feature-agent` | `/backlog-agent --generate-wireframes` |
| `build-feature-agent` | Orchestrates user story implementation: `plan-development-tasks` → implement → analyze → UX review [if UI] → code review → unit tests | /devops-agent | `/build-feature-agent us_001` |
| `bug-fixing-agent` | Orchestrates bug resolution: `plan-bug-resolution` → identify test impact → implement → analyze → UX review [if UI] → code review → update tests [if needed] → run test suite | PR/Deploy | `/bug-fixing-agent bug_042` |
| `devops-agent` | Orchestrates DevOps phase: `plan-cloud-infrastructure` → `create-iac` → `plan-cicd-pipeline` → `create-pipeline-scripts` → `review-devops-security` | Artifacts ready for deployment | `/devops-agent --scope full` |
| `validation-agent` | Orchestrates test automation: `create-automation-test` → `generate-playwright-scripts` → test execution → validation report | `/pull-request` or `/devops-agent` | `/validation-agent --type both` |

## Instructions

| Instruction | Description |
|------|-------------|
| `ai-assistant-usage-policy` | Prevents cascade from wreaking havoc across your codebase. Prioritizes explicit user commands, factual verification over internal knowledge, and adherence to interaction philosophy. |
| `agile-methodology-guidelines` | Story breakdown best practices with max 5 story points per story (1 point = 8 hours), ensuring independent and deliverable standalone units. |
| `angular-development-standards` | Modern Angular patterns following official style guide with TypeScript strict mode, standalone components, signals, and reactive forms. |
| `aspnet-webapi-standards` | ASP.NET Core 9 REST API development with Controllers and Minimal API styles, proper routing, validation, and error handling. |
| `backend-development-standards` | Higher-level system design ensuring correctness under failure, evolvability, data integrity, observability, and production readiness. |
| `cicd-pipeline-standards` | CI/CD pipeline security and quality gates including SAST, SCA, container scanning, secrets detection, and deployment approvals. |
| `cloud-architecture-standards` | Well-Architected Framework patterns for multi-cloud providers covering networking, compute, security, and monitoring. |
| `code-anti-patterns` | Fast detection and prevention of common mistakes including god objects, circular dependencies, magic constants, and silent error swallowing. |
| `code-documentation-standards` | Self-explanatory code with minimal comments. Comment WHY, not WHAT. Write code that speaks for itself. |
| `csharp-coding-standards` | C# development standards with high-confidence suggestions, design decision documentation, and modern language feature usage. |
| `database-standards` | Higher-order data architecture covering modeling, normalization, indexing, query optimization, migration strategies, and operational quality. |
| `development-foundations` | Reference guidelines for analyzing existing tasks, understanding patterns, and maintaining consistency in task structure and naming conventions. |
| `dotnet-architecture-standards` | SOLID principles and .NET best practices for robust, maintainable systems with dependency injection, middleware patterns, and clean architecture. |
| `dry-principle-guidelines` | Enforces single-source-of-truth, prevents duplication, ensures minimal-impact changes. Anti-redundancy and surgical change rules for all artifacts. |
| `figma-design-standards` | Figma design standards for 6-page file structure, naming conventions, auto layout, component organization, and prototype flows. |
| `frontend-development-standards` | Advanced structural and operational frontend guidance covering styling, state management, component architecture, and build optimization. |
| `gitops-standards` | GitOps principles for declarative infrastructure, environment promotion, and automated reconciliation. |
| `iterative-development-guide` | Mandatory workflow process instructions requiring full review before execution and exact adherence without deviation. |
| `language-agnostic-standards` | Cross-language baseline applying KISS, YAGNI, fail-fast validation, size limits, naming clarity, error handling, and deterministic tests. |
| `markdown-styleguide` | Markdown content rules for headings, lists, code blocks, links, front matter, and proper formatting conventions. |
| `mcp-integration-standards` | MCP usage guidelines covering pagination policy for tools returning large lists, logs, files, or code with proper iteration patterns. |
| `performance-best-practices` | Performance optimization covering frontend (rendering, assets), backend (caching, async), and database (indexing, query) layers with measurement-first approach. |
| `playwright-standards` | Quick-reference checklist for Playwright locator priority, required patterns, forbidden patterns, and assertion usage. |
| `playwright-testing-guide` | Playwright testing focusing on stability, flakiness avoidance, suite sustainability, proper selectors, and explicit waits. |
| `playwright-typescript-guide` | Playwright code quality standards for test writing with TypeScript, including naming conventions and structure patterns. |
| `react-development-standards` | Modern React patterns following official documentation with hooks, functional components, context, and performance optimization. |
| `security-standards-owasp` | Enforces OWASP security best practices covering access control, encryption, injection prevention, secure configurations, and vulnerability management. |
| `software-architecture-patterns` | Architecture pattern selection matrix with guidance on layered, hexagonal, CQRS, event-driven, and microservices patterns. |
| `stored-procedure-standards` | SQL development standards for table/column naming (singular form), indexing, query optimization, and stored procedure best practices. |
| `terraform-iac-standards` | Terraform IaC standards for multi-cloud providers including module design, state management, and security patterns. |
| `template-implementation-guide` | Template structure compliance ensuring workflows produce outcomes following referenced template structure in `.propel/templates` folder. |
| `typescript-styleguide` | TypeScript development targeting 5.x/ES2022 with strict mode, type safety, modern syntax, and proper module organization. |
| `ui-ux-design-standards` | UI design and system guidance covering tokens, layout hierarchy, accessibility alignment, and interaction quality with users-first philosophy. |
| `uml-text-code-standards` | PlantUML and Mermaid diagram standards ensuring clarity, consistency, single-page focus, and proper notation usage. |
| `unit-testing-standards` | Test strategies by technology focusing on minimal tests during development, core user flows only, and strategic test placement. |
| `web-accessibility-standards` | WCAG 2.2 Level AA accessibility guidance ensuring semantic HTML, keyboard navigation, ARIA attributes, and color contrast compliance. |

## Templates

| Template | Description |
|----------|-------------|
| `automated-e2e-template` | E2E journey test workflow with session requirements, phase-based steps, checkpoints, and cross-UC traceability. |
| `automated-testing-template` | Feature-level test workflow with Happy Path, Edge Case, and Error test cases per Use Case, including YAML steps and page objects. |
| `code-review-template` | Comprehensive code review report with security assessment, licensing compliance, technology-specific analysis, and actionable feedback. |
| `codebase-analysis-template` | Comprehensive reverse engineering documentation with executive summaries, technical deep-dives, and actionable insights. |
| `cicd-specification-template` | CI/CD specification with CICD-XXX requirements, pipeline stages, security gates, and environment configurations. |
| `component-inventory-template` | UI component catalog extracted from wireframes with type classification, screen usage, and implementation status. |
| `design-analysis-template` | Design review report documenting blockers, high-priority issues, and UX findings with screenshots. |
| `design-model-template` | UML models template including conceptual, component, deployment, data flow diagrams, ERD, and sequence diagrams. |
| `design-reference-template` | UI impact assessment linking user stories to Figma projects, design images, or design system documentation. |
| `design-specification-template` | Context-rich implementation guide with validation loops, architecture goals, and progressive success strategy. |
| `devops-security-review-template` | Security review report with infrastructure posture, IaC analysis, pipeline security, and compliance assessment. |
| `epics-template` | Epic template with summary table, EP-XXX IDs, mapped requirement IDs, priorities, business value, and deliverables. |
| `figma-specification-template` | Figma design specification with UX requirements (UXR-XXX), screen inventory, component library, and design system tokens. |
| `findings-registry-template` | Registry of critical/high code review findings with root cause analysis for historical context and pattern detection. |
| `iac-module-template` | Terraform module documentation with inputs, outputs, resources, dependencies, and usage examples. |
| `infra-specification-template` | Infrastructure specification with INFRA-XXX, SEC-XXX, OPS-XXX, ENV-XXX requirements for cloud deployments. |
| `issue-triage-template` | Bug triage results with root cause analysis, fix implementation tasks, and systematic validation. |
| `project-plan-template` | Project plan with executive summary, scope definition, AI-adjusted effort estimation, team composition, milestones, cost baseline, risk register, and sprint planning bridge. |
| `requirements-template` | Standardized feature requirements with ID formats, use cases, user stories, and acceptance criteria. |
| `sprint-plan-template` | Sprint plan with configuration, epic dependency map, dependency-ordered sprint backlog, sprint goals, critical path analysis, load balance assessment, and coverage report. |
| `task-analysis-template` | Implementation analysis report with traceability matrix, logical findings, and pass/fail verdict. |
| `task-template` | AI-optimized task structure with context-rich details, validation loops, and iterative refinement approach. |
| `test-plan-template` | E2E test plan with test cases for FR, UC, NFR, TR, DR requirements, risk assessment, traceability matrix, and entry/exit criteria. |
| `unit-test-template` | Unit test plan template with user story reference, test coverage strategy, and validation criteria. |
| `user-story-template` | Canonical user story format with acceptance criteria, edge cases, traceability IDs, and INVEST principles. |
| `wireframe-reference-template` | Information architecture documentation with Figma/HTML wireframe references and screen inventory. |

---

## Prompt Execution Hierarchy

### Greenfield Projects (New Development)

```
/create-spec <project-scope.md>
│   Output: spec.md (functional requirements, use cases)
│
├── /design-architecture
│   │   Output: design.md (non-functional, technical, data requirements)
│   │
│   ├── /design-model
│   │   │   Output: models.md (UML diagrams, sequences)
│   │   │
│   │   └── /create-epics
│   │       │   Output: epics.md (epic decomposition, mappings) [includes EP-TECH]
│   │       │
│   │       └── /create-user-stories <EP-XXX>
│   │           │   Output: us_XXX.md (stories, acceptance criteria)
│   │           │
│   │           ├── /plan-development-tasks <us_XXX.md>
│   │           │   │   Output: task_XXX.md (implementation tasks)
│   │           │   │
│   │           │   └── /implement-tasks <task_XXX.md>
│   │           │       │   Output: Source code (added/updated files)
│   │           │       │
│   │           │       ├── /analyze-implementation <task_XXX.md>
│   │           │       │       Output: Console (gap analysis, verdict)
│   │           │       │
│   │           │       ├── /analyze-ux [IF UI impact]
│   │           │       │       Output: ux-analysis.md (accessibility, compliance)
│   │           │       │
│   │           │       ├── /review-code
│   │           │       │       Output: review_<timestamp>.md (findings, recommendations)
│   │           │       │
│   │           │       └── /pull-request
│   │           │               Output: PR (GitHub/Azure DevOps)
│   │           │
│   │           └── /plan-unit-tests <us_XXX>
│   │               │   Output: test_plan_XXX.md (test cases, coverage)
│   │               │
│   │               └── /implement-tasks <test_plan_XXX.md>
│   │                       Output: Source code (added/updated files)
│   │
│   ├── /create-project-plan
│   │   │   Output: project_plan.md (scope, milestones, cost baseline, risk register, team composition)
│   │   │
│   │   └── /create-sprint-plan [requires epics.md, us_*.md]
│   │           Output: sprint_plan.md (dependency-ordered sprints, sprint goals, critical path)
│   │
│   ├── /plan-cloud-infrastructure
│   │   │   Output: .propel/context/devops/infra-spec.md
│   │   │
│   │   └── /create-iac
│   │           Output: .propel/context/iac/<provider>/terraform/
│   │
│   ├── /plan-cicd-pipeline
│   │   │   Output: .propel/context/devops/cicd-spec.md
│   │   │
│   │   └── /create-pipeline-scripts
│   │           Output: .propel/context/pipelines/github-actions/
│   │
│   └── /review-devops-security
│           Output: .propel/context/devops/security-reviews/review_*.md
│
├── /create-figma-spec [IF UI impact]
│   │   Output: figma_spec.md (UX requirements, screens)
│   │   Output: designsystem.md (tokens, typography, colors)
│   │
│   ├── /generate-wireframe
│   │       Output: wireframes/ (HTML wireframes, inventory)
│   │
│   └── /generate-figma
│           Output: Figma artifacts (structures, exports)
│
└── /create-test-plan [--scope full|critical|regression|feature:<name>]
    │   Output: test_plan_[feature].md (test cases, traceability)
    │
    └── /create-automation-test [--type feature|e2e|both]
        │   Output: tw_<feature>.md, e2e_<journey>.md (test workflow specifications)
        │
        └── /generate-playwright-scripts [--type feature|e2e|both]
                Output: test-automation/ (Playwright TypeScript scripts, page objects)
```

### Brownfield Projects (Existing Codebase)

#### Quick Enhancement (Direct to User Stories)

For small enhancements where requirements are clear and no epic decomposition is needed.

```
/analyze-codebase
│   Output: codeanalysis.md (architecture, patterns, debt)
│
├── /design-model [references codeanalysis.md]
│   │   Output: models.md (UML diagrams, sequences)
│   │
│   └── /create-user-stories <enhancement-requirement>
│       │   Output: us_XXX.md (stories, acceptance criteria)
│       │
│       ├── /plan-development-tasks <us_XXX.md>
│       │   │   Output: task_XXX.md (implementation tasks)
│       │   │
│       │   └── /implement-tasks <task_XXX.md>
│       │       │   Output: Source code (added/updated files)
│       │       │
│       │       ├── /analyze-implementation <task_XXX.md>
│       │       │       Output: Console (gap analysis, verdict)
│       │       │
│       │       ├── /analyze-ux [IF UI impact]
│       │       │       Output: ux-analysis.md (accessibility, compliance)
│       │       │
│       │       ├── /review-code
│       │       │       Output: review_<timestamp>.md (findings, recommendations)
│       │       │
│       │       └── /pull-request
│       │               Output: PR (GitHub/Azure DevOps)
│       │
│       └── /plan-unit-tests <us_XXX>
│           │   Output: test_plan_XXX.md (test cases, coverage)
│           │
│           └── /implement-tasks <test_plan_XXX.md>
│                   Output: Source code (added/updated files)
│
└── /create-figma-spec [IF UI impact]
    │   Output: figma_spec.md (UX requirements, screens)
    │   Output: designsystem.md (tokens, typography, colors)
    │
    ├── /generate-wireframe
    │       Output: wireframes/ (HTML wireframes, inventory)
    │
    └── /generate-figma
            Output: Figma artifacts (structures, exports)
```

#### Medium Enhancement (With Epic Decomposition)

For larger enhancements requiring epic breakdown but not full requirements specification.

```
/analyze-codebase
│   Output: codeanalysis.md (architecture, patterns, debt)
│
├── /design-model [references codeanalysis.md]
│   │   Output: models.md (UML diagrams, sequences)
│   │
│   ├── /create-epics <enhancement-feature.md>
│   │   │   Output: epics.md (epic decomposition, mappings) [NO EP-TECH]
│   │   │
│   │   └── /create-user-stories <EP-XXX>
│   │       │   Output: us_XXX.md (stories, acceptance criteria)
│   │       │
│   │       ├── /plan-development-tasks <us_XXX.md>
│   │       │   │   Output: task_XXX.md (implementation tasks)
│   │       │   │
│   │       │   └── /implement-tasks <task_XXX.md>
│   │       │       │   Output: Source code (added/updated files)
│   │       │       │
│   │       │       ├── /analyze-implementation <task_XXX.md>
│   │       │       │       Output: Console (gap analysis, verdict)
│   │       │       │
│   │       │       ├── /analyze-ux [IF UI impact]
│   │       │       │       Output: ux-analysis.md (accessibility, compliance)
│   │       │       │
│   │       │       ├── /review-code
│   │       │       │       Output: review_<timestamp>.md (findings, recommendations)
│   │       │       │
│   │       │       └── /pull-request
│   │       │               Output: PR (GitHub/Azure DevOps)
│   │       │
│   │       └── /plan-unit-tests <us_XXX>
│   │           │   Output: test_plan_XXX.md (test cases, coverage)
│   │           │
│   │           └── /implement-tasks <test_plan_XXX.md>
│   │                   Output: Source code (added/updated files)
│   │
│   ├── /create-sprint-plan [requires epics.md, us_*.md]
│   │       Output: sprint_plan.md (dependency-ordered sprints, sprint goals, critical path)
│   │
│   ├── /plan-cloud-infrastructure
│   │   │   Output: .propel/context/devops/infra-spec.md
│   │   │
│   │   └── /create-iac
│   │           Output: .propel/context/iac/<provider>/terraform/
│   │
│   ├── /plan-cicd-pipeline
│   │   │   Output: .propel/context/devops/cicd-spec.md
│   │   │
│   │   └── /create-pipeline-scripts
│   │           Output: .propel/context/pipelines/github-actions/
│   │
│   └── /review-devops-security
│           Output: .propel/context/devops/security-reviews/review_*.md
│
└── /create-figma-spec [IF UI impact]
    │   Output: figma_spec.md (UX requirements, screens)
    │   Output: designsystem.md (tokens, typography, colors)
    │
    ├── /generate-wireframe
    │       Output: wireframes/ (HTML wireframes, inventory)
    │
    └── /generate-figma
            Output: Figma artifacts (structures, exports)
```

#### Comprehensive Enhancement (Full Requirements Analysis)

For major enhancements requiring complete requirements specification and architecture design.

```
/analyze-codebase
│   Output: codeanalysis.md (architecture, patterns, debt)
│
└── /create-spec <enhancement-scope.md>
    │   Output: spec.md (functional requirements, use cases)
    │
    ├── /design-architecture
    │   │   Output: design.md (non-functional, technical, data requirements)
    │   │
    │   ├── /design-model
    │   │   │   Output: models.md (UML diagrams, sequences)
    │   │   │
    │   │   └── /create-epics
    │   │       │   Output: epics.md (epic decomposition, mappings) [NO EP-TECH]
    │   │       │
    │   │       └── /create-user-stories <EP-XXX>
    │   │           │   Output: us_XXX.md (stories, acceptance criteria)
    │   │           │
    │   │           ├── /plan-development-tasks <us_XXX.md>
    │   │           │   │   Output: task_XXX.md (implementation tasks)
    │   │           │   │
    │   │           │   └── /implement-tasks <task_XXX.md>
    │   │           │       │   Output: Source code (added/updated files)
    │   │           │       │
    │   │           │       ├── /analyze-implementation <task_XXX.md>
    │   │           │       │       Output: Console (gap analysis, verdict)
    │   │           │       │
    │   │           │       ├── /analyze-ux [IF UI impact]
    │   │           │       │       Output: ux-analysis.md (accessibility, compliance)
    │   │           │       │
    │   │           │       ├── /review-code
    │   │           │       │       Output: review_<timestamp>.md (findings, recommendations)
    │   │           │       │
    │   │           │       └── /pull-request
    │   │           │               Output: PR (GitHub/Azure DevOps)
    │   │           │
    │   │           └── /plan-unit-tests <us_XXX>
    │   │               │   Output: test_plan_XXX.md (test cases, coverage)
    │   │               │
    │   │               └── /implement-tasks <test_plan_XXX.md>
    │   │                       Output: Source code (added/updated files)
    │   │
    │   ├── /create-project-plan
    │   │   │   Output: project_plan.md (scope, milestones, cost baseline, risk register, team composition)
    │   │   │
    │   │   └── /create-sprint-plan [requires epics.md, us_*.md]

## Project Artifacts Status

| Artifact | Status | Location |
|----------|--------|----------|
| **Specifications** | [DONE] Complete | `.propel/context/docs/` |
| - Functional Requirements | [DONE] Present | `spec.md` |
| - Design & Architecture | [DONE] Present | `design.md` |
| - UI/UX Specification | [DONE] Present | `figma_spec.md` |
| - Design System | [DONE] Present | `designsystem.md` |
| - Data Models | [DONE] Present | `models.md` |
| **Backlog** | [DONE] Complete | `.propel/context/tasks/` |
| - Epics | [DONE] 10 epics | `epics.md` |
| - User Stories | [DONE] 140+ stories | `EP-XXX/us_XXX/` |
| - Task Decomposition | [DONE] 2-3 per story | `task_*.md` |
| **Infrastructure** | [DONE] Complete | `.propel/context/iac/gcp/` |
| - Terraform Modules | [DONE] Present | `terraform/` |
| - Multi-environment Config | [DONE] dev/staging/prod | `environments/` |
| **CI/CD** | [DONE] Active | `.github/workflows/` |
| - CI Workflow | [DONE] Active | `ci.yml` |
| - Security Scanning | [DONE] Active | `security-gates.yml` |
| - GCP Deployment | [DONE] Active | `gcp-terraform-deploy.yml` |
| **UI/UX** | [DONE] Complete | `.propel/context/wireframes/` |
| - Wireframes (22) | [DONE] HTML + CSS | `Hi-Fi/` |
| - Component Library | [DONE] Present | `component-inventory.md` |
| - Navigation Map | [DONE] Present | `navigation-map.md` |
| **Local Development** | [DONE] Ready | Project Root |
| - Docker Compose | [DONE] PostgreSQL + Redis | `docker-compose.yml` |
| - Dockerfile (API) | [DONE] Multi-stage | `Dockerfile.api` |
| - Dockerfile (Frontend) | [DONE] Multi-stage | `Dockerfile.frontend` |
| - TypeScript Config | [DONE] Configured | `tsconfig.json` |
| - Playwright Config | [DONE] Configured | `playwright.config.ts` |
| **Documentation** | [DONE] Complete | Project Root |
| - Quick Start Guide | [DONE] 5-minute setup | `QUICKSTART.md` |
| - GCP Setup Guide | [DONE] Step-by-step | `GCP_SETUP.md` |
| - Validation Checklist | [DONE] Comprehensive | `VALIDATION.md` |

## Documentation Map

### Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** — 5-minute local setup with Docker
- **[GCP_SETUP.md](GCP_SETUP.md)** — Complete GCP deployment guide (Phases 1-5)
- **[VALIDATION.md](VALIDATION.md)** — Project validation checklist

### Development Standards
- **[.github/instructions/](./github/instructions/)** — 40+ development standards (languages, frameworks, security, testing)
- **[.github/prompts/](./github/prompts/)** — 36 MCP agent prompts for automated workflows
- **[.propel/templates/](./propel/templates/)** — 27 code generation templates

### Architecture & Design
- **[.propel/context/docs/spec.md](./.propel/context/docs/spec.md)** — Functional requirements (FR-XXX, UC-XXX)
- **[.propel/context/docs/design.md](./.propel/context/docs/design.md)** — Architecture & non-functional requirements
- **[.propel/context/docs/figma_spec.md](./.propel/context/docs/figma_spec.md)** — UI/UX specifications
- **[.propel/context/docs/designsystem.md](./.propel/context/docs/designsystem.md)** — Design tokens & component library
- **[.propel/context/docs/models.md](./.propel/context/docs/models.md)** — UML diagrams and data models

### Implementation
- **[.propel/context/tasks/](./propel/context/tasks/)** — User stories with task decomposition (140+ items)
- **[.propel/context/wireframes/](./propel/context/wireframes/)** — 22 responsive UI wireframes
- **[.propel/context/iac/gcp/](./propel/context/iac/gcp/)** — GCP Terraform infrastructure

### DevOps & Deployment
- **[.github/workflows/](./github/workflows/)** — 3 active CI/CD workflows
- **[GCP_SETUP.md](GCP_SETUP.md)** — GCP authentication and deployment steps
- **[docker-compose.yml](docker-compose.yml)** — Local PostgreSQL + Redis

## Next Steps

1. **Local Development**
   ```bash
   docker-compose up -d
   # Services running on: postgres:5432, redis:6379
   ```

2. **Cloud Deployment**
   - Follow [GCP_SETUP.md](GCP_SETUP.md) (45-60 minutes, one-time setup)
   - Deploy via GitHub Actions (manual dispatch)

3. **Validate Project**
   - Run checklist in [VALIDATION.md](VALIDATION.md)
   - Expected score: 70/80 → Ready for development

4. **Generate Application**
   - Use orchestrators to generate React + ASP.NET source code
   - Update Dockerfiles and CI/CD with build steps
   - Push images to Artifact Registry
   - Deploy via Cloud Run

---

**Last Updated**: 2026-04-22  
**Status**: Framework Complete, Ready for Application Integration  
**Next Phase**: Application source code generation and deployment
    │   │           Output: sprint_plan.md (dependency-ordered sprints, sprint goals, critical path)
    │   │
    │   ├── /plan-cloud-infrastructure
    │   │   │   Output: .propel/context/devops/infra-spec.md
    │   │   │
    │   │   └── /create-iac
    │   │           Output: .propel/context/iac/<provider>/terraform/
    │   │
    │   ├── /plan-cicd-pipeline
    │   │   │   Output: .propel/context/devops/cicd-spec.md
    │   │   │
    │   │   └── /create-pipeline-scripts
    │   │           Output: .propel/context/pipelines/github-actions/
    │   │
    │   └── /review-devops-security
    │           Output: .propel/context/devops/security-reviews/review_*.md
    │
    ├── /create-figma-spec [IF UI impact]
    │   │   Output: figma_spec.md (UX requirements, screens)
    │   │   Output: designsystem.md (tokens, typography, colors)
    │   │
    │   ├── /generate-wireframe
    │   │       Output: wireframes/ (HTML wireframes, inventory)
    │   │
    │   └── /generate-figma
    │           Output: Figma artifacts (structures, exports)
    │
    └── /create-test-plan [--scope full|critical|regression|feature:<name>]
        │   Output: test_plan_[feature].md (test cases, traceability)
        │
        └── /create-automation-test [--type feature|e2e|both]
            │   Output: tw_<feature>.md, e2e_<journey>.md (test workflow specifications)
            │
            └── /generate-playwright-scripts [--type feature|e2e|both]
                    Output: test-automation/ (Playwright TypeScript scripts, page objects)
```

### Bug Resolution Track

```
/plan-bug-resolution <bug-report.md>
│   Output: task_XXX.md (root cause, fix tasks)
│
└── /implement-tasks <task_XXX.md>
    │   Output: Source code (bug fixes)
    │
    ├── /analyze-implementation <task_XXX.md>
    │       Output: Console (gap analysis, verdict)
    │
    ├── /analyze-ux [IF UI impact]
    │       Output: ux-analysis.md (accessibility, compliance)
    │
    ├── /review-code
    │       Output: review_<timestamp>.md (findings, recommendations)
    │
    └── /pull-request
            Output: PR (GitHub/Azure DevOps)
```

### Rapid Prototyping Track

```
/build-prototype "<business hypothesis>"
    Output: mvp/ (working prototype)
    Constraint: 80-hour timebox (priority-based scoping if exceeds budget)
```

---

*For detailed prompt documentation, refer to individual prompt files in `.github/prompts/`. For comprehensive instructions details, see files in `.github/instructions/`. For template structures, see files in `.propel/templates/`.*
