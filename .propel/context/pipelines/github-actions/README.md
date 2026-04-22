# GitHub Actions Pipeline Scripts

These workflows were generated from the create-pipeline-scripts process and are intended as production-ready baselines.

## Files

- ci.yml: Pull request and main-branch CI with .NET tests, Playwright smoke tests (when e2e project exists), test artifacts, and service containers.
- security-gates.yml: Dependency review, CodeQL, secret scanning, and Trivy filesystem scanning.
- deploy.yml: Multi-environment deployment workflow (dev/staging/prod) with environment protection support.

## How to Activate

1. Create .github/workflows in your repository root.
2. Copy these files into .github/workflows.
3. Commit and push.

## Required GitHub Secrets

- CI_JWT_SIGNING_KEY
- DEV_DEPLOY_HOST
- DEV_DEPLOY_TOKEN
- STAGING_DEPLOY_HOST
- STAGING_DEPLOY_TOKEN
- PROD_DEPLOY_HOST
- PROD_DEPLOY_TOKEN

## Required GitHub Variables

- APP_NAME

## Playwright in CI

The CI workflow runs Playwright smoke tests automatically when `e2e/package.json` is present.

Expected structure:

- client/package.json
- e2e/package.json
- e2e/tests/smoke/

Execution flow in ci.yml:

- Installs Node dependencies for `client` and `e2e`
- Installs Chromium via Playwright
- Starts SPA dev server on port 3000
- Waits for readiness with `wait-on`
- Runs `npx playwright test tests/smoke --reporter=junit,line`
- Uploads Playwright artifacts and test results

## Environment Protection

Configure GitHub Environments for dev, staging, and prod:

- Add required reviewers for prod.
- Add branch restrictions as needed.
- Scope environment secrets to each environment.

## Notes

- The deploy workflow intentionally fails if no deploy script exists. Provide one of:
  - scripts/deploy.sh
  - scripts/deploy.ps1
- The CI workflow auto-detects whether .NET, frontend, and e2e projects exist.
- All workflows use least-privilege permissions by default.
