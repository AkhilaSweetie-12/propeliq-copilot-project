# GCP Setup Guide for PropelIQ Deployment

This guide walks you through setting up Google Cloud Platform infrastructure for deploying the PropelIQ healthcare platform.

## Prerequisites

- Google Cloud Platform account with billing enabled
- gcloud CLI installed and configured
- Docker installed
- Terraform installed
- GitHub repository with admin access

## Phase 1: GCP Project Setup

### 1.1 Create and Configure GCP Project

```bash
# Set your project ID (choose a unique name)
export PROJECT_ID="propeliq-dev"
export REGION="us-central1"

# Create new project
gcloud projects create $PROJECT_ID --name="PropelIQ Healthcare Platform"

# Set active project
gcloud config set project $PROJECT_ID

# Link billing account (get your billing account ID)
gcloud billing accounts list
gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### 1.2 Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudkms.googleapis.com \
  storage-component.googleapis.com \
  iam.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  --project=$PROJECT_ID
```

### 1.3 Create Service Account

```bash
# Create service account for Terraform
gcloud iam service-accounts create propeliq-terraform-sa \
  --description="Service account for Terraform infrastructure deployment" \
  --display-name="PropelIQ Terraform Service Account"

# Get service account email
SERVICE_ACCOUNT_EMAIL="propeliq-terraform-sa@$PROJECT_ID.iam.gserviceaccount.com"
```

### 1.4 Grant Permissions to Service Account

```bash
# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudsql.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudrun.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudkms.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/compute.networkAdmin"
```

### 1.5 Create Terraform State Bucket

```bash
# Create GCS bucket for Terraform state
BUCKET_NAME="${PROJECT_ID}-terraform-state"
gsutil mb -l $REGION gs://$BUCKET_NAME

# Enable versioning
gsutil versioning set on gs://$BUCKET_NAME

# Enable uniform bucket-level access
gsutil iam ch uniformBucketLevelAccess:enabled gs://$BUCKET_NAME

# Grant service account access
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"
```

## Phase 2: Update Terraform Configuration

### 2.1 Update terraform.tfvars

Edit `terraform/terraform.tfvars` with your actual values:

```hcl
project_id              = "propeliq-dev"
region                  = "us-central1"
project_name            = "propeliq"
environment             = "dev"
terraform_state_bucket   = "propeliq-dev-terraform-state"

# Database configuration
database_name           = "propeliq_db"
database_user           = "propeliq_user"
```

### 2.2 Update backend.hcl

Edit `terraform/backend.hcl`:

```hcl
bucket  = "propeliq-dev-terraform-state"
prefix  = "terraform/state"
```

## Phase 3: Configure GitHub Secrets

### 3.1 Setup Workload Identity Federation

```bash
# Get your GitHub repository information
GITHUB_OWNER="your-username-or-org"
GITHUB_REPO="propeliq-copilot-project"

# Create workload identity pool
gcloud iam workload-identity-pools create github-pool \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Get pool number
POOL_NUMBER=$(gcloud iam workload-identity-pools describe github-pool \
  --location="global" \
  --format='value(name)' | awk -F'/' '{print $NF}')

# Create OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Get provider number
PROVIDER_NUMBER=$(gcloud iam workload-identity-pools providers describe github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format='value(name)' | awk -F'/' '{print $NF}')

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# Create workload identity provider
WORKLOAD_IDENTITY_PROVIDER="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NUMBER/workloadIdentityPoolProviders/$PROVIDER_NUMBER"

# Grant service account access to GitHub Actions
gcloud iam service-accounts add-iam-policy-binding $SERVICE_ACCOUNT_EMAIL \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NUMBER/attribute.repository/$GITHUB_OWNER/$GITHUB_REPO"
```

### 3.2 Add GitHub Secrets

Navigate to your GitHub repository → Settings → Secrets and variables → Actions and add these secrets:

```
GCP_WORKLOAD_IDENTITY_PROVIDER: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_NUMBER/workloadIdentityPoolProviders/PROVIDER_NUMBER
GCP_TERRAFORM_SERVICE_ACCOUNT: propeliq-terraform-sa@propeliq-dev.iam.gserviceaccount.com
TERRAFORM_BUCKET: propeliq-dev-terraform-state
GCP_PROJECT_ID: propeliq-dev
CI_JWT_SIGNING_KEY: (generate a random 32-byte key)
DEV_DB_CONNECTION_STRING: (will be created by Terraform)
STAGING_DB_CONNECTION_STRING: (will be created by Terraform)
PROD_DB_CONNECTION_STRING: (will be created by Terraform)
```

## Phase 4: First Deployment Test

### 4.1 Initialize Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Create execution plan
terraform plan -var-file="terraform.tfvars" -out="tfplan"

# Apply the plan
terraform apply tfplan
```

### 4.2 Test Infrastructure Deployment

```bash
# Run the deployment script
chmod +x ../scripts/deploy.sh
../scripts/deploy.sh dev
```

### 4.3 Verify Deployment

```bash
# List Cloud Run services
gcloud run services list --region=$REGION

# Get service URLs
FRONTEND_URL=$(gcloud run services describe propeliq-frontend-dev --region=$REGION --format='value(status.url)')
BACKEND_URL=$(gcloud run services describe propeliq-api-dev --region=$REGION --format='value(status.url)')

echo "Frontend: $FRONTEND_URL"
echo "Backend: $BACKEND_URL"

# Test health endpoints
curl -f "$FRONTEND_URL/health"
curl -f "$BACKEND_URL/health"
```

## Phase 5: Environment Setup

### 5.1 Development Environment

The development environment is automatically deployed when pushing to the main branch.

### 5.2 Staging Environment

```bash
# Deploy to staging via GitHub Actions
# Go to GitHub → Actions → Deploy to GCP
# Click "Run workflow" and select:
# - environment: staging
# - operation: apply
```

### 5.3 Production Environment

```bash
# Deploy to production via GitHub Actions
# Go to GitHub → Actions → Deploy to GCP
# Click "Run workflow" and select:
# - environment: prod
# - operation: apply
```

## Phase 6: Monitoring and Logging

### 6.1 View Logs

```bash
# View Cloud Run logs
gcloud logs read "resource.type=cloud_run_revision" --limit=50 --format="table(timestamp,textPayload)"

# View logs for specific service
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=propeliq-api-dev" --limit=50
```

### 6.2 View Metrics

```bash
# List available metrics
gcloud monitoring metrics list --filter="propeliq"

# View error rate
gcloud monitoring metrics descriptor describe logging.googleapis.com/user/error_count
```

### 6.3 Set up Alerting

The monitoring configuration includes predefined alert policies. You can customize them in the `monitoring/alerts.yaml` file.

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   ```bash
   # Ensure service account has correct permissions
   gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"
   ```

2. **Terraform State Lock Issues**
   ```bash
   # Force unlock Terraform state
   terraform force-unlock LOCK_ID
   ```

3. **Cloud Run Deployment Failures**
   ```bash
   # Check Cloud Run logs
   gcloud run services describe SERVICE_NAME --region=$REGION --format="value(status.latestReadyRevisionName)"
   gcloud logs read "resource.type=cloud_run_revision AND resource.labels.revision_name=REVISION_NAME"
   ```

4. **Database Connection Issues**
   ```bash
   # Check Cloud SQL instance status
   gcloud sql instances describe INSTANCE_NAME
   
   # Test database connection
   gcloud sql connect INSTANCE_NAME --user=propeliq_user
   ```

### Cleanup

If you need to clean up all resources:

```bash
cd terraform
terraform destroy -var-file="terraform.tfvars"

# Delete GCS bucket
gsutil rm -r gs://$BUCKET_NAME

# Delete service account
gcloud iam service-accounts delete $SERVICE_ACCOUNT_EMAIL

# Delete project (use with caution)
gcloud projects delete $PROJECT_ID
```

## Next Steps

1. **Configure DNS**: Set up custom domain names for your services
2. **SSL Certificates**: Configure HTTPS with custom domains
3. **CI/CD Optimization**: Fine-tune build and deployment pipelines
4. **Security Hardening**: Implement additional security measures
5. **Performance Tuning**: Optimize resource allocation and scaling

## Support

For issues with:
- **GCP Services**: Check the [Google Cloud documentation](https://cloud.google.com/docs)
- **Terraform**: Check the [Terraform documentation](https://developer.hashicorp.com/terraform/docs)
- **GitHub Actions**: Check the [GitHub Actions documentation](https://docs.github.com/en/actions)

## Security Considerations

- Regularly rotate service account keys
- Use least privilege principle for IAM roles
- Enable VPC Service Controls for additional security
- Implement audit logging and monitoring
- Regularly review and update security policies
