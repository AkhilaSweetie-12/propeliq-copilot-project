# GCP & GitHub Setup Guide

This guide walks you through setting up the required GCP infrastructure and GitHub secrets to deploy PropelIQ-Copilot projects using the active CI/CD pipeline.

---

## Prerequisites

- [ ] GCP account with billing enabled
- [ ] `gcloud` CLI installed locally
- [ ] GitHub repository access (admin role)
- [ ] Terraform CLI installed (v1.5+)
- [ ] Docker installed (for local testing)

---

## Phase 1: GCP Project Setup

### Step 1.1: Create or Select GCP Project

```bash
# List existing projects
gcloud projects list

# Create new project (if needed)
export PROJECT_ID="propeliq-copilot-dev"
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud config set project $PROJECT_ID
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
```

**Store these values** — you'll need them in later steps.

### Step 1.2: Enable Required APIs

```bash
# Enable services required for Terraform and Cloud Run
gcloud services enable \
  compute.googleapis.com \
  cloudrun.googleapis.com \
  cloudsql.googleapis.com \
  sqladmin.googleapis.com \
  container.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  iap.googleapis.com \
  iam.googleapis.com \
  cloudkms.googleapis.com \
  secretmanager.googleapis.com \
  --project=$PROJECT_ID

echo "✓ APIs enabled"
```

### Step 1.3: Create Terraform Backend Bucket

```bash
# Create GCS bucket for Terraform state
export TERRAFORM_BUCKET="propeliq-terraform-state-${PROJECT_ID}"

gsutil mb -p $PROJECT_ID -l us-central1 gs://$TERRAFORM_BUCKET/

# Enable versioning and encryption
gsutil versioning set on gs://$TERRAFORM_BUCKET/
gsutil encryption set gs://cs.googleapis.com $TERRAFORM_BUCKET

# Block public access
gsutil iam ch serviceAccount:terraform@$PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
  gs://$TERRAFORM_BUCKET

echo "Terraform bucket created: gs://$TERRAFORM_BUCKET"
```

### Step 1.4: Create Service Account for Terraform

```bash
# Create service account
gcloud iam service-accounts create terraform \
  --display-name="Terraform Service Account" \
  --project=$PROJECT_ID

# Grant necessary roles
for role in roles/editor roles/secretmanager.admin roles/iam.serviceAccountAdmin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role"
done

# Create key (optional, for manual runs)
# gcloud iam service-accounts keys create terraform.json \
#   --iam-account=terraform@${PROJECT_ID}.iam.gserviceaccount.com

echo "Service account created: terraform@${PROJECT_ID}.iam.gserviceaccount.com"
```

### Step 1.5: Set Up Workload Identity Federation (GitHub ↔ GCP)

This allows GitHub Actions to authenticate to GCP without storing long-lived keys.

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --disabled=false

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,assertion.aud=assertion.aud" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-condition="assertion.aud == 'sts.amazonaws.com'" \
  --disabled=false

# Get the full resource name of the provider
export WORKLOAD_IDENTITY_PROVIDER=$(gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool="github-pool" \
  --format='value(name)')

echo "Workload Identity Provider: $WORKLOAD_IDENTITY_PROVIDER"
```

### Step 1.6: Create GitHub-to-GCP Identity Mapping

```bash
# Bind GitHub Actions to the Terraform service account
# Replace OWNER/REPO with your GitHub repository

export GITHUB_OWNER="your-github-username"
export GITHUB_REPO="PropelIQ-Copilot-project"

gcloud iam service-accounts add-iam-policy-binding \
  "terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository_owner/${GITHUB_OWNER}"

echo "✓ GitHub-to-GCP binding created"
```

---

## Phase 2: Update Terraform Configuration

### Step 2.1: Update Environment Variables

Edit the Terraform variables files to use your GCP project:

```bash
# Edit .propel/context/iac/gcp/terraform/environments/dev/dev.tfvars

cat > .propel/context/iac/gcp/terraform/environments/dev/dev.tfvars <<EOF
project_id          = "$PROJECT_ID"
region               = "us-central1"
environment          = "dev"
app_name             = "propeliq"
enable_public_access = true
EOF

# Repeat for staging and prod
cat > .propel/context/iac/gcp/terraform/environments/staging/staging.tfvars <<EOF
project_id          = "$PROJECT_ID"
region              = "us-central1"
environment         = "staging"
app_name            = "propeliq"
enable_public_access = false
EOF

cat > .propel/context/iac/gcp/terraform/environments/prod/prod.tfvars <<EOF
project_id          = "$PROJECT_ID"
region              = "us-central1"
environment         = "prod"
app_name            = "propeliq"
enable_public_access = false
EOF
```

### Step 2.2: Update Backend Configuration

```bash
# Edit .propel/context/iac/gcp/terraform/environments/dev/backend.hcl

cat > .propel/context/iac/gcp/terraform/environments/dev/backend.hcl <<EOF
bucket         = "$TERRAFORM_BUCKET"
prefix         = "terraform/dev"
encryption_key = "projects/$PROJECT_ID/locations/us/keyRings/terraform/cryptoKeys/state"
EOF

# Repeat for staging
cat > .propel/context/iac/gcp/terraform/environments/staging/backend.hcl <<EOF
bucket = "$TERRAFORM_BUCKET"
prefix = "terraform/staging"
EOF

# Repeat for prod
cat > .propel/context/iac/gcp/terraform/environments/prod/backend.hcl <<EOF
bucket = "$TERRAFORM_BUCKET"
prefix = "terraform/prod"
EOF
```

### Step 2.3: Validate Terraform Configuration

```bash
cd .propel/context/iac/gcp/terraform

# Initialize (uses local state for validation)
terraform init -backend=false

# Validate syntax
terraform validate

# Check formatting
terraform fmt -check -recursive .

echo "✓ Terraform configuration valid"
```

---

## Phase 3: Configure GitHub Secrets

### Step 3.1: Add GitHub Repository Secrets

1. Go to **GitHub Repository → Settings → Secrets and variables → Actions**

2. Create the following secrets:

   **`GCP_WORKLOAD_IDENTITY_PROVIDER`**
   ```
   Copy the value from: $WORKLOAD_IDENTITY_PROVIDER
   (from Step 1.5)
   ```

   **`GCP_TERRAFORM_SERVICE_ACCOUNT`**
   ```
   terraform@${PROJECT_ID}.iam.gserviceaccount.com
   ```

   **`TERRAFORM_BUCKET`**
   ```
   gs://${TERRAFORM_BUCKET}
   (from Step 1.3)
   ```

   **`CI_JWT_SIGNING_KEY`** (for CI tests)
   ```bash
   # Generate a random 256-bit key
   openssl rand -base64 32
   ```

### Step 3.2: Create GitHub Environments

1. Go to **Settings → Environments**
2. Create three environments: **dev**, **staging**, **prod**

For **prod** environment:
- Enable "Require reviewers" (add 1-2 team members)
- Set deployment branches to "main"

### Step 3.3: Verify Secrets

```bash
# List configured secrets (names only, for verification)
# Check GitHub UI to confirm all 4 secrets are present
```

---

## Phase 4: First Deployment Test

### Step 4.1: Manual Terraform Plan (Dry-run)

1. Go to **GitHub → Actions → GCP Terraform Deploy**
2. Click **Run workflow**
3. Select:
   - Environment: `dev`
   - Operation: `plan`
   - Cloud Run Image (optional): leave blank
4. Click **Run workflow**

### Step 4.2: Review Plan Output

- Click on the workflow run to view logs
- Scroll to "Terraform Plan" step
- Verify that resources are planned for creation (VPC, Cloud SQL, Cloud Run, etc.)
- Check for any errors or warnings

### Step 4.3: Apply (If Plan Succeeds)

1. Run the workflow again with:
   - Environment: `dev`
   - Operation: `apply`

2. Monitor the logs for successful resource creation

### Step 4.4: Verify GCP Resources

```bash
# List created Cloud Run services
gcloud run services list --project=$PROJECT_ID --region=us-central1

# List Cloud SQL instances
gcloud sql instances list --project=$PROJECT_ID

# Check VPC network
gcloud compute networks describe propeliq-vpc --project=$PROJECT_ID
```

---

## Phase 5: Local Development Setup

### Step 5.1: Start Local Services

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Verify services are running
docker-compose ps

# Check database connectivity
docker exec propeliq-postgres psql -U propeliq_user -d propeliq_dev -c "SELECT version();"
```

### Step 5.2: Initialize Database Schema

```bash
# Connect to database and run migrations
# (Once you have the API source code)

docker exec propeliq-postgres psql -U propeliq_user -d propeliq_dev < ./scripts/init-db.sql
```

### Step 5.3: Run CI Locally

```bash
# Test CI workflow locally using act (requires Docker)
# https://github.com/nektos/act

act pull_request \
  --container-daemon \
  --job detect-stack

# Or run specific test
act --job api-tests
```

---

## Troubleshooting

### Issue: `Workload Identity authentication failed`

**Solution**: Verify the OIDC provider token audience matches the configuration:
```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format='value(attribute_condition)'
```

### Issue: `Terraform state bucket access denied`

**Solution**: Ensure service account has `Storage Object Admin` role on the bucket:
```bash
gsutil iam ch serviceAccount:terraform@${PROJECT_ID}.iam.gserviceaccount.com:objectAdmin \
  gs://$TERRAFORM_BUCKET
```

### Issue: `Cloud Run deployment fails: image not found`

**Solution**: Build and push the image to Artifact Registry first:
```bash
gcloud builds submit \
  --substitutions=_SERVICE_NAME=propeliq-api,_REGION=us-central1 \
  --config=src/api/cloudbuild.yaml
```

---

## Next Steps

1. **Activate other CI/CD workflows**:
   - Push to `main` branch to trigger `ci.yml` and `security-gates.yml`

2. **Deploy application**:
   - Once you have API/Frontend source code, update Dockerfiles
   - Push images to Artifact Registry
   - Update Cloud Run deployment

3. **Enable monitoring**:
   - Configure Cloud Logging and Cloud Monitoring
   - Set up alerting for production

4. **Secure production**:
   - Enable Cloud Armor for DDoS protection
   - Configure Secret Manager for API keys
   - Enable Binary Authorization for container image signing

---

## Reference

| Item | Value |
|------|-------|
| GCP Project ID | `$PROJECT_ID` |
| Terraform Bucket | `gs://$TERRAFORM_BUCKET` |
| Service Account | `terraform@${PROJECT_ID}.iam.gserviceaccount.com` |
| Workload Identity Provider | `$WORKLOAD_IDENTITY_PROVIDER` |
| Region | `us-central1` |
| Database | PostgreSQL 16 (Cloud SQL) |
| Cache | Redis 7 (Cloud Memorystore) |
| Compute | Cloud Run v2 |

---

**Last Updated**: 2026-04-22  
**Document Version**: 1.0
