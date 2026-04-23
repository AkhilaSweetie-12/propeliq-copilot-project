#!/bin/bash

# GCP Setup Script for PropelIQ
# This script sets up the initial GCP infrastructure and configuration

set -e

# Default values
PROJECT_ID=${1:-propeliq-dev}
REGION=${2:-us-central1}
SERVICE_ACCOUNT_NAME="propeliq-terraform-sa"

echo "INFO: Setting up GCP for PropelIQ deployment..."
echo "INFO: Project ID: $PROJECT_ID"
echo "INFO: Region: $REGION"

# Function to check if required tools are installed
check_prerequisites() {
  echo "INFO: Checking prerequisites..."
  
  if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI is not installed"
    echo "INFO: Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi
  
  echo "SUCCESS: Prerequisites check passed"
}

# Function to create or select GCP project
setup_project() {
  echo "INFO: Setting up GCP project..."
  
  # Check if project exists
  if gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    echo "SUCCESS: Project $PROJECT_ID already exists"
  else
    echo "INFO: Creating new project: $PROJECT_ID"
    gcloud projects create "$PROJECT_ID" --name="PropelIQ Healthcare Platform"
  fi
  
  # Set active project
  gcloud config set project "$PROJECT_ID"
  
  # Link billing account (you'll need to provide the billing account ID)
  BILLING_ACCOUNT=$(gcloud billing accounts list --format='value(name)' | head -n1)
  if [ -n "$BILLING_ACCOUNT" ]; then
    echo "INFO: Linking billing account..."
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
  else
    echo "WARNING: No billing account found. Please link a billing account manually:"
    echo "   gcloud billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID"
  fi
  
  echo "SUCCESS: Project setup completed"
}

# Function to enable required APIs
enable_apis() {
  echo "INFO: Enabling required APIs..."
  
  APIS=(
    "run.googleapis.com"
    "sqladmin.googleapis.com"
    "secretmanager.googleapis.com"
    "cloudkms.googleapis.com"
    "storage-component.googleapis.com"
    "iam.googleapis.com"
    "cloudbuild.googleapis.com"
    "containerregistry.googleapis.com"
    "logging.googleapis.com"
    "monitoring.googleapis.com"
    "compute.googleapis.com"
    "servicenetworking.googleapis.com"
  )
  
  for api in "${APIS[@]}"; do
    echo "  Enabling $api..."
    gcloud services enable "$api" --project="$PROJECT_ID"
  done
  
  echo "SUCCESS: APIs enabled"
}

# Function to create service account
create_service_account() {
  echo "INFO: Creating service account..."
  
  if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com" &>/dev/null; then
    echo "SUCCESS: Service account already exists"
  else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
      --description="Service account for Terraform infrastructure deployment" \
      --display-name="PropelIQ Terraform Service Account"
  fi
  
  SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
  echo "INFO: Service account email: $SERVICE_ACCOUNT_EMAIL"
}

# Function to grant permissions to service account
grant_permissions() {
  echo "INFO: Granting permissions to service account..."
  
  ROLES=(
    "roles/editor"
    "roles/cloudsql.admin"
    "roles/cloudrun.admin"
    "roles/secretmanager.admin"
    "roles/cloudkms.admin"
    "roles/storage.admin"
    "roles/iam.serviceAccountUser"
    "roles/compute.networkAdmin"
    "roles/compute.securityAdmin"
    "roles/resourcemanager.projectIamAdmin"
  )
  
  for role in "${ROLES[@]}"; do
    echo "  Granting $role..."
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
      --role="$role"
  done
  
  echo "SUCCESS: Permissions granted"
}

# Function to create Terraform state bucket
create_state_bucket() {
  echo "INFO: Creating Terraform state bucket..."
  
  BUCKET_NAME="${PROJECT_ID}-terraform-state"
  
  if gsutil ls "gs://$BUCKET_NAME" &>/dev/null; then
    echo "SUCCESS: State bucket already exists"
  else
    echo "INFO: Creating bucket: $BUCKET_NAME"
    gsutil mb -l "$REGION" "gs://$BUCKET_NAME"
    
    # Enable versioning
    gsutil versioning set on "gs://$BUCKET_NAME"
    
    # Enable uniform bucket-level access
    gsutil iam ch uniformBucketLevelAccess:enabled "gs://$BUCKET_NAME"
  fi
  
  # Grant service account access to bucket
  gcloud storage buckets add-iam-policy-binding "gs://$BUCKET_NAME" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.admin"
  
  echo "SUCCESS: State bucket created: $BUCKET_NAME"
}

# Function to setup Workload Identity Federation
setup_workload_identity() {
  echo "INFO: Setting up Workload Identity Federation..."
  
  # Get GitHub repository info
  echo "INFO: Please provide your GitHub repository information:"
  read -p "GitHub owner (username or organization): " GITHUB_OWNER
  read -p "GitHub repository name: " GITHUB_REPO
  
  # Create workload identity pool
  POOL_NAME="github-pool"
  PROVIDER_NAME="github-provider"
  
  if ! gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" &>/dev/null; then
    echo "INFO: Creating workload identity pool..."
    gcloud iam workload-identity-pools create "$POOL_NAME" \
      --location="global" \
      --display-name="GitHub Actions Pool"
  fi
  
  # Get pool number
  POOL_NUMBER=$(gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" --format='value(name)' | awk -F'/' '{print $NF}')
  
  # Create OIDC provider
  if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" &>/dev/null; then
    
    echo "INFO: Creating OIDC provider..."
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
      --location="global" \
      --workload-identity-pool="$POOL_NAME" \
      --display-name="GitHub Provider" \
      --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
      --issuer-uri="https://token.actions.githubusercontent.com"
  fi
  
  # Get provider number
  PROVIDER_NUMBER=$(gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --location="global" \
    --workload-identity-pool="$POOL_NAME" \
    --format='value(name)' | awk -F'/' '{print $NF}')
  
  # Create workload identity provider
  WORKLOAD_IDENTITY_PROVIDER="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NUMBER/workloadIdentityPoolProviders/$PROVIDER_NUMBER"
  
  # Grant service account access to GitHub Actions
  gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NUMBER/attribute.repository/$GITHUB_OWNER/$GITHUB_REPO"
  
  echo "SUCCESS: Workload Identity Federation setup completed"
  echo ""
  echo "INFO: Add these secrets to your GitHub repository:"
  echo "   GCP_WORKLOAD_IDENTITY_PROVIDER: $WORKLOAD_IDENTITY_PROVIDER"
  echo "   GCP_TERRAFORM_SERVICE_ACCOUNT: $SERVICE_ACCOUNT_EMAIL"
  echo "   TERRAFORM_BUCKET: $BUCKET_NAME"
  echo "   GCP_PROJECT_ID: $PROJECT_ID"
}

# Function to update configuration files
update_configs() {
  echo "INFO: Updating configuration files..."
  
  # Update terraform.tfvars
  if [ -f "terraform/terraform.tfvars" ]; then
    sed -i.bak "s/your-gcp-project-id/$PROJECT_ID/g" terraform/terraform.tfvars
    sed -i "s/your-terraform-state-bucket-name/$BUCKET_NAME/g" terraform/terraform.tfvars
    rm terraform/terraform.tfvars.bak
  fi
  
  # Update backend.hcl
  if [ -f "terraform/backend.hcl" ]; then
    sed -i.bak "s/your-terraform-state-bucket-name/$BUCKET_NAME/g" terraform/backend.hcl
    rm terraform/backend.hcl.bak
  fi
  
  echo "SUCCESS: Configuration files updated"
}

# Function to display setup summary
setup_summary() {
  echo ""
  echo "INFO: GCP Setup Summary"
  echo "==================="
  echo "INFO: Project ID: $PROJECT_ID"
  echo "INFO: Region: $REGION"
  echo "INFO: Service Account: $SERVICE_ACCOUNT_EMAIL"
  echo "INFO: Terraform State Bucket: $BUCKET_NAME"
  echo ""
  echo "INFO: Next Steps:"
  echo "1. Update your GitHub repository secrets with the values shown above"
  echo "2. Run: ./scripts/deploy.sh dev"
  echo "3. Monitor the deployment in GitHub Actions"
  echo ""
  echo "INFO: Useful commands:"
  echo "  gcloud config set project $PROJECT_ID"
  echo "  gcloud run services list --region $REGION"
  echo "  gsutil ls gs://$BUCKET_NAME"
}

# Main setup flow
main() {
  echo "INFO: GCP Setup Script for PropelIQ"
  echo "==============================="
  
  # Get project number
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' 2>/dev/null || echo "")
  
  check_prerequisites
  setup_project
  enable_apis
  create_service_account
  grant_permissions
  create_state_bucket
  setup_workload_identity
  update_configs
  setup_summary
  
  echo ""
  echo "SUCCESS: GCP setup completed successfully!"
}

# Handle script interruption
trap 'echo "ERROR: Setup interrupted"; exit 1' INT

# Run main function
main "$@"
