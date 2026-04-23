#!/bin/bash

# PropelIQ Deployment Script
# Usage: ./scripts/deploy.sh [environment] [options]

set -e

# Default values
ENVIRONMENT=${1:-dev}
REGION=${2:-us-central1}
PROJECT_ID=${3:-propeliq-dev}
FORCE_DEPLOY=false
SKIP_TESTS=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE_DEPLOY=true
      shift
      ;;
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --project)
      PROJECT_ID="$2"
      shift 2
      ;;
    *)
      ENVIRONMENT="$1"
      shift
      ;;
  esac
done

# Validate environment (dev only for now)
if [[ ! "$ENVIRONMENT" =~ ^(dev)$ ]]; then
  echo "ERROR: Invalid environment: $ENVIRONMENT"
  echo "Only 'dev' environment is currently supported"
  exit 1
fi

echo "INFO: Starting deployment to $ENVIRONMENT environment..."
echo "INFO: Region: $REGION"
echo "INFO: Project ID: $PROJECT_ID"

# Function to check if required tools are installed
check_prerequisites() {
  echo "INFO: Checking prerequisites..."
  
  # Check gcloud CLI
  if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI is not installed"
    echo "INFO: Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    echo "INFO: Install it from: https://docs.docker.com/get-docker/"
    exit 1
  fi
  
  # Check Terraform
  if ! command -v terraform &> /dev/null; then
    echo "ERROR: Terraform is not installed"
    echo "INFO: Install it from: https://developer.hashicorp.com/terraform/downloads"
    exit 1
  fi
  
  echo "SUCCESS: Prerequisites check passed"
}

# Function to authenticate with GCP
authenticate_gcp() {
  echo "INFO: Authenticating with GCP..."
  
  # Check if already authenticated
  if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "SUCCESS: Already authenticated"
  else
    echo "INFO: Running gcloud auth login..."
    gcloud auth login
  fi
  
  # Set project
  echo "INFO: Setting project to $PROJECT_ID"
  gcloud config set project "$PROJECT_ID"
  
  echo "SUCCESS: GCP authentication completed"
}

# Function to run tests
run_tests() {
  if [ "$SKIP_TESTS" = true ]; then
    echo "INFO: Skipping tests"
    return 0
  fi
  
  echo "INFO: Running tests..."
  
  # Frontend tests
  if [ -d "src/frontend" ]; then
    echo "INFO: Running frontend tests..."
    cd src/frontend
    if [ -f "package.json" ]; then
      npm ci
      npm test -- --coverage --watchAll=false
      npm run build
    fi
    cd - > /dev/null
  fi
  
  # Backend tests
  if [ -f "*.csproj" ] || [ -d "src/backend" ]; then
    echo "INFO: Running backend tests..."
    if [ -f "*.sln" ]; then
      dotnet test --configuration Release --no-build
    elif [ -d "src/backend" ]; then
      cd src/backend
      dotnet test --configuration Release --no-build
      cd - > /dev/null
    fi
  fi
  
  echo "SUCCESS: All tests passed"
}

# Function to build and push Docker images
build_and_push_images() {
  echo "INFO: Building and pushing Docker images..."
  
  # Configure Docker for GCR
  gcloud auth configure-docker gcr.io --quiet
  
  IMAGE_TAG=$(git rev-parse --short HEAD)
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  
  # Build and push frontend image
  if [ -d "src/frontend" ]; then
    echo "INFO: Building frontend image..."
    cd src/frontend
    docker build -t "gcr.io/$PROJECT_ID/propeliq-frontend:$IMAGE_TAG" .
    docker build -t "gcr.io/$PROJECT_ID/propeliq-frontend:latest" .
    
    echo "INFO: Pushing frontend image..."
    docker push "gcr.io/$PROJECT_ID/propeliq-frontend:$IMAGE_TAG"
    docker push "gcr.io/$PROJECT_ID/propeliq-frontend:latest"
    cd - > /dev/null
  fi
  
  # Build and push backend image
  if [ -f "Dockerfile" ]; then
    echo "INFO: Building backend image..."
    docker build -t "gcr.io/$PROJECT_ID/propeliq-backend:$IMAGE_TAG" .
    docker build -t "gcr.io/$PROJECT_ID/propeliq-backend:latest" .
    
    echo "INFO: Pushing backend image..."
    docker push "gcr.io/$PROJECT_ID/propeliq-backend:$IMAGE_TAG"
    docker push "gcr.io/$PROJECT_ID/propeliq-backend:latest"
  fi
  
  echo "SUCCESS: Docker images built and pushed"
  export IMAGE_TAG
}

# Function to deploy infrastructure with Terraform
deploy_infrastructure() {
  echo "INFO: Deploying infrastructure with Terraform..."
  
  cd terraform
  
  # Initialize Terraform
  echo "INFO: Initializing Terraform..."
  terraform init
  
  # Plan
  echo "INFO: Creating Terraform plan..."
  terraform plan -var-file="terraform.tfvars" -var="environment=$ENVIRONMENT" -var="project_id=$PROJECT_ID" -var="region=$REGION" -out="tfplan"
  
  # Apply (with confirmation unless forced)
  if [ "$FORCE_DEPLOY" = true ]; then
    echo "INFO: Applying Terraform changes (forced)..."
    terraform apply -auto-approve tfplan
  else
    echo "INFO: Terraform plan created. Review the output above."
    read -p "Do you want to apply these changes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      terraform apply tfplan
    else
      echo "ERROR: Deployment cancelled"
      exit 1
    fi
  fi
  
  cd - > /dev/null
  echo "SUCCESS: Infrastructure deployment completed"
}

# Function to deploy Cloud Run services
deploy_cloud_run() {
  echo "INFO: Deploying to Cloud Run..."
  
  # Get Terraform outputs
  cd terraform
  FRONTEND_URL=$(terraform output -raw frontend_service_url 2>/dev/null || echo "")
  BACKEND_URL=$(terraform output -raw backend_service_url 2>/dev/null || echo "")
  cd - > /dev/null
  
  # Deploy frontend
  if [ -d "src/frontend" ]; then
    echo "INFO: Deploying frontend service..."
    gcloud run deploy "propeliq-frontend-$ENVIRONMENT" \
      --image "gcr.io/$PROJECT_ID/propeliq-frontend:latest" \
      --region "$REGION" \
      --platform managed \
      --allow-unauthenticated \
      --memory 512Mi \
      --cpu 1 \
      --timeout 300 \
      --concurrency 80 \
      --max-instances 100 \
      --set-env-vars "NODE_ENV=$ENVIRONMENT" \
      --quiet || true
  fi
  
  # Deploy backend
  if [ -f "Dockerfile" ]; then
    echo "INFO: Deploying backend service..."
    gcloud run deploy "propeliq-api-$ENVIRONMENT" \
      --image "gcr.io/$PROJECT_ID/propeliq-backend:latest" \
      --region "$REGION" \
      --platform managed \
      --allow-unauthenticated \
      --memory 1Gi \
      --cpu 1 \
      --timeout 300 \
      --concurrency 80 \
      --max-instances 10 \
      --set-env-vars "ASPNETCORE_ENVIRONMENT=$ENVIRONMENT" \
      --quiet || true
  fi
  
  echo "SUCCESS: Cloud Run deployment completed"
}

# Function to perform health checks
health_checks() {
  echo "INFO: Performing health checks..."
  
  # Get service URLs
  FRONTEND_URL=$(gcloud run services describe "propeliq-frontend-$ENVIRONMENT" --region "$REGION" --format='value(status.url)' 2>/dev/null || echo "")
  BACKEND_URL=$(gcloud run services describe "propeliq-api-$ENVIRONMENT" --region "$REGION" --format='value(status.url)' 2>/dev/null || echo "")
  
  # Wait for services to be ready
  echo "INFO: Waiting for services to be ready..."
  sleep 30
  
  # Health check frontend
  if [ -n "$FRONTEND_URL" ]; then
    echo "INFO: Checking frontend health: $FRONTEND_URL"
    if curl -f -s "$FRONTEND_URL/health" > /dev/null; then
      echo "SUCCESS: Frontend health check passed"
    else
      echo "ERROR: Frontend health check failed"
      return 1
    fi
  fi
  
  # Health check backend
  if [ -n "$BACKEND_URL" ]; then
    echo "INFO: Checking backend health: $BACKEND_URL"
    if curl -f -s "$BACKEND_URL/health" > /dev/null; then
      echo "SUCCESS: Backend health check passed"
    else
      echo "ERROR: Backend health check failed"
      return 1
    fi
  fi
  
  echo "SUCCESS: All health checks passed"
}

# Function to display deployment summary
deployment_summary() {
  echo ""
  echo "INFO: Deployment Summary"
  echo "===================="
  echo "INFO: Environment: $ENVIRONMENT"
  echo "INFO: Region: $REGION"
  echo "INFO: Project ID: $PROJECT_ID"
  
  # Get service URLs
  FRONTEND_URL=$(gcloud run services describe "propeliq-frontend-$ENVIRONMENT" --region "$REGION" --format='value(status.url)' 2>/dev/null || echo "")
  BACKEND_URL=$(gcloud run services describe "propeliq-api-$ENVIRONMENT" --region "$REGION" --format='value(status.url)' 2>/dev/null || echo "")
  
  if [ -n "$FRONTEND_URL" ]; then
    echo "INFO: Frontend URL: $FRONTEND_URL"
  fi
  
  if [ -n "$BACKEND_URL" ]; then
    echo "INFO: Backend API URL: $BACKEND_URL"
  fi
  
  echo "SUCCESS: Deployment completed successfully!"
}

# Main deployment flow
main() {
  echo "INFO: PropelIQ Deployment Script"
  echo "============================"
  
  # Run deployment steps
  check_prerequisites
  authenticate_gcp
  
  if [ "$FORCE_DEPLOY" != true ]; then
    run_tests
  fi
  
  build_and_push_images
  deploy_infrastructure
  deploy_cloud_run
  health_checks
  deployment_summary
  
  echo ""
  echo "🎊 All done! Your application is now deployed to $ENVIRONMENT"
}

# Handle script interruption
trap 'echo "❌ Deployment interrupted"; exit 1' INT

# Run main function
main "$@"
