# Setup Credentials and Configuration

This guide provides the commands to set up all necessary credentials and configuration for the PropelIQ deployment pipeline.

## **Step 1: GCP Project Setup**

### **Create GCP Project**
```bash
# Set your project ID (choose a unique name)
export PROJECT_ID="propeliq-dev"
export REGION="us-central1"

# Create new project
gcloud projects create $PROJECT_ID --name="PropelIQ Healthcare Platform"

# Set active project
gcloud config set project $PROJECT_ID

# Link billing account (get your billing account ID first)
gcloud billing accounts list
gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

### **Enable Required APIs**
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

### **Create Service Account**
```bash
# Create service account for Terraform
gcloud iam service-accounts create propeliq-terraform-sa \
  --description="Service account for Terraform infrastructure deployment" \
  --display-name="PropelIQ Terraform Service Account"

# Get service account email
SERVICE_ACCOUNT_EMAIL="propeliq-terraform-sa@$PROJECT_ID.iam.gserviceaccount.com"
echo "Service account email: $SERVICE_ACCOUNT_EMAIL"
```

### **Grant Permissions to Service Account**
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

### **Create Terraform State Bucket**
```bash
# Create GCS bucket for Terraform state
BUCKET_NAME="${PROJECT_ID}-terraform-state"
gsutil mb -l $REGION gs://$BUCKET_NAME

# Enable versioning
gsutil versioning set on gs://$BUCKET_NAME

# Enable uniform bucket-level access
gsutil iam ch uniformBucketLevelAccess:enabled gs://$BUCKET_NAME

# Grant service account access to bucket
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"

echo "Terraform state bucket: $BUCKET_NAME"
```

## **Step 2: Workload Identity Federation Setup**

### **Get GitHub Repository Information**
```bash
# Set your GitHub repository information
GITHUB_OWNER="your-username-or-org"
GITHUB_REPO="propeliq-copilot-project"

echo "GitHub owner: $GITHUB_OWNER"
echo "GitHub repository: $GITHUB_REPO"
```

### **Create Workload Identity Pool and Provider**
```bash
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

echo "Workload Identity Provider: $WORKLOAD_IDENTITY_PROVIDER"
```

## **Step 3: Update Configuration Files**

### **Update Terraform Configuration**
```bash
# Update terraform.tfvars with your actual values
sed -i "s/your-gcp-project-id/$PROJECT_ID/g" terraform/terraform.tfvars
sed -i "s/your-terraform-state-bucket-name/$BUCKET_NAME/g" terraform/terraform.tfvars

# Update backend.hcl
sed -i "s/your-terraform-state-bucket-name/$BUCKET_NAME/g" terraform/backend.hcl
```

### **Verify Configuration**
```bash
# Check terraform.tfvars
cat terraform/terraform.tfvars

# Check backend.hcl
cat terraform/backend.hcl
```

## **Step 4: Add GitHub Secrets**

Navigate to your GitHub repository → Settings → Secrets and variables → Actions and add these secrets:

### **Required GitHub Secrets**
```bash
# Copy these values to GitHub repository secrets
echo "GCP_WORKLOAD_IDENTITY_PROVIDER: $WORKLOAD_IDENTITY_PROVIDER"
echo "GCP_TERRAFORM_SERVICE_ACCOUNT: $SERVICE_ACCOUNT_EMAIL"
echo "TERRAFORM_BUCKET: $BUCKET_NAME"
echo "GCP_PROJECT_ID: $PROJECT_ID"

# Generate JWT signing key
JWT_SIGNING_KEY=$(openssl rand -base64 32)
echo "CI_JWT_SIGNING_KEY: $JWT_SIGNING_KEY"
```

### **Database Connection String (after Terraform deployment)**
```bash
# This will be available after running Terraform
# You'll get the actual values from Terraform outputs
echo "DEV_DB_CONNECTION_STRING: Host=<PRIVATE_IP>;Port=5432;Database=propeliq_db;Username=propeliq_user;Password=<GENERATED_PASSWORD>;SSL Mode=Require;"
```

## **Step 5: Initialize and Test Terraform**

### **Initialize Terraform**
```bash
cd terraform

# Initialize Terraform
terraform init

# Create execution plan
terraform plan -var-file="terraform.tfvars" -out="tfplan"

# Apply the plan
terraform apply tfplan

cd ..
```

### **Verify Infrastructure**
```bash
# Check Cloud Run services
gcloud run services list --region=$REGION

# Check Cloud SQL instance
gcloud sql instances list --project=$PROJECT_ID

# Check storage bucket
gsutil ls gs://$BUCKET_NAME
```

## **Step 6: Install Dependencies and Test**

### **Frontend Dependencies**
```bash
cd src/frontend

# Install dependencies
npm ci

# Run tests
npm test -- --coverage --watchAll=false

# Build application
npm run build

cd ../..
```

### **Backend Dependencies**
```bash
cd src/backend

# Restore dependencies
dotnet restore

# Run tests
dotnet test --configuration Release --no-build

# Build application
dotnet build --configuration Release --no-build

cd ../..
```

## **Step 7: Test Deployment Scripts**

### **Make Scripts Executable**
```bash
chmod +x scripts/deploy.sh
chmod +x scripts/setup-gcp.sh
```

### **Test Setup Script**
```bash
# Run setup script (if not already done)
./scripts/setup-gcp.sh $PROJECT_ID $REGION
```

### **Test Deployment Script**
```bash
# Deploy to development
./scripts/deploy.sh dev

# Or force deploy (skip tests)
./scripts/deploy.sh dev --force
```

## **Step 8: Verify Complete Setup**

### **Check GitHub Actions**
1. Push code to main branch:
```bash
git add .
git commit -m "Add application files and configuration"
git push origin main
```

2. Check GitHub Actions tab for pipeline execution

### **Verify Deployment**
```bash
# Get service URLs
FRONTEND_URL=$(gcloud run services describe propeliq-frontend-dev --region $REGION --format='value(status.url)')
BACKEND_URL=$(gcloud run services describe propeliq-api-dev --region $REGION --format='value(status.url)')

echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL: $BACKEND_URL"

# Test health endpoints
curl -f "$FRONTEND_URL/health"
curl -f "$BACKEND_URL/health"
```

## **Troubleshooting Commands**

### **Check GCP Authentication**
```bash
gcloud auth list
gcloud config list
```

### **Check Service Account Permissions**
```bash
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"
```

### **Check Terraform State**
```bash
cd terraform
terraform state list
terraform show
cd ..
```

### **Check Cloud Run Logs**
```bash
gcloud logs read "resource.type=cloud_run_revision" --limit=50
```

### **Clean Up (if needed)**
```bash
cd terraform
terraform destroy -var-file="terraform.tfvars"
cd ..
```

## **Summary of Required Values**

After completing this setup, you should have:

1. **GCP Project ID**: `propeliq-dev` (or your chosen ID)
2. **Service Account Email**: `propeliq-terraform-sa@propeliq-dev.iam.gserviceaccount.com`
3. **Terraform State Bucket**: `propeliq-dev-terraform-state`
4. **Workload Identity Provider**: Full URL from step 2
5. **GitHub Secrets**: All added to repository settings
6. **Database Connection**: Available after Terraform deployment

Your deployment pipeline is now ready to run automatically when you push to the main branch!
