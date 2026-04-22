# GCP Terraform IaC

This folder contains production-ready Terraform scaffolding for GCP with multi-environment support.

## Scope

- VPC, subnet, and private service networking for managed services
- Cloud Run service for API/runtime workloads
- Cloud SQL for PostgreSQL with private IP and TLS-focused posture
- Secret Manager and KMS for secret and key management workflows
- Logging and monitoring baselines through managed Google services

## Structure

- modules/platform: Reusable platform module
- environments/dev|staging|prod: Environment-specific tfvars and backend settings

## Usage

1. Authenticate with a workload identity or service account.
2. Initialize per environment:
   - terraform init -backend-config=environments/dev/backend.hcl
3. Plan and apply:
   - terraform plan -var-file=environments/dev/dev.tfvars
   - terraform apply -var-file=environments/dev/dev.tfvars

## Security Notes

- Do not put secrets into tfvars.
- Bind runtime service accounts with least privilege.
- Add VPC Service Controls if your compliance posture requires stricter egress controls.
- Consider Binary Authorization for image provenance in higher environments.

## Phase-1 Constraint Note

The project documents prioritize GitHub Codespaces for Phase 1. This GCP IaC is generated as a future-ready deployment path for later environments.