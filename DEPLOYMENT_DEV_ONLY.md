# Development-Only Deployment Setup

This guide covers the simplified deployment pipeline configured for development environment only.

## Current Setup

### **Automatic Development Deployment**

**When you push to `main` branch:**
1. **CI Pipeline** runs automatically
2. **Security Gates** scan for vulnerabilities
3. **Deploy Pipeline** automatically deploys to development environment

**Manual development deployment:**
- Go to GitHub → Actions → Deploy to Development
- Click "Run workflow" (no environment selection needed)
- Optionally check "Force deployment" to skip tests

## 📋 Simplified Workflow

### **Daily Development Flow**

```bash
# 1. Make your changes
git add . && git commit -m "Add new feature"
git push origin main

# 2. Pipeline runs automatically:
#    - Tests run
#    - Security scans execute  
#    - Docker images build
#    - Deploy to dev environment
#    - Health checks verify deployment

# 3. Check results:
#    - GitHub Actions tab shows pipeline status
#    - Dev environment auto-updates
#    - Health checks verify deployment
```

### **Manual Deployment (if needed)**

```bash
# Deploy manually with script
./scripts/deploy.sh dev

# Or force deploy (skip tests)
./scripts/deploy.sh dev --force
```

## Infrastructure Components

**Development Environment Only:**
- **VPC Network**: Private networking for security
- **Cloud SQL**: PostgreSQL database with pgvector
- **Cloud Run Services**: 
  - `propeliq-frontend-dev` (React app)
  - `propeliq-api-dev` (.NET API)
- **KMS Keys**: Encryption for sensitive data
- **Secret Manager**: Secure credential storage
- **Monitoring**: Logs, metrics, and alerts

## Configuration Files

### **GitHub Actions**
- **`.github/workflows/ci.yml`**: Continuous integration
- **`.github/workflows/security-gates.yml`**: Security scanning
- **`.github/workflows/deploy.yml`**: Development deployment only

### **Terraform**
- **`terraform/main.tf`**: Infrastructure definition
- **`terraform/variables.tf`**: Dev-only environment validation
- **`terraform/terraform.tfvars`**: Your project configuration

### **Scripts**
- **`scripts/deploy.sh`**: Deployment script (dev only)
- **`scripts/setup-gcp.sh`**: GCP setup script

## Monitoring & Alerts

**Development Monitoring:**
- **Error rate alerts**: High error count notifications
- **Response time alerts**: Slow API performance
- **Resource usage**: Memory/CPU utilization
- **Health checks**: Automatic service verification

## Adding Staging/Production Later

When you're ready to add staging and production environments:

### **1. Update GitHub Actions**
```yaml
# Add environment selection back to deploy.yml
inputs:
  environment:
    type: choice
    options: [dev, staging, prod]
```

### **2. Add Terraform Workspaces**
```bash
# Create staging environment
terraform workspace new staging
terraform workspace new prod
```

### **3. Update Scripts**
```bash
# Remove environment validation in deploy.sh
# Allow staging and prod options
```

### **4. Add GitHub Secrets**
```
STAGING_DB_CONNECTION_STRING
PROD_DB_CONNECTION_STRING
```

## Current Deployment Triggers

**Automatic:**
- Push to `main` branch → Development deployment

**Manual:**
- GitHub Actions → Deploy to Development → Run workflow

## Environment URLs

After deployment:
- **Frontend**: `https://propeliq-frontend-dev-xxxxx-xx.a.run.app`
- **Backend API**: `https://propeliq-api-dev-xxxxx-xx.a.run.app`

(Actual URLs provided in deployment summary)

## Troubleshooting

**Common Issues:**
1. **Build failures**: Check GitHub Actions logs
2. **Deployment failures**: Check Cloud Run logs
3. **Health check failures**: Verify service endpoints
4. **Permission errors**: Check GCP service account permissions

**Quick Commands:**
```bash
# Check service status
gcloud run services list --region=us-central1

# View logs
gcloud logs read "resource.type=cloud_run_revision" --limit=50

# Test health endpoints
curl -f "https://your-service-url/health"
```

## Benefits of Dev-Only Setup

- **Simplicity**: Fewer environments to manage
- **Faster iteration**: Immediate feedback on changes
- **Lower costs**: Single environment deployment
- **Easier debugging**: Centralized development environment
- **Gradual expansion**: Easy to add environments later

## Support

For deployment issues:
1. Check GitHub Actions logs
2. Review GCP Console for service status
3. Verify configuration in terraform.tfvars
4. Run `./scripts/deploy.sh dev --force` for troubleshooting

This setup provides a streamlined development-focused deployment pipeline that can be expanded to multi-environment when needed.
