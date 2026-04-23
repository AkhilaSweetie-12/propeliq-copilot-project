# Terraform backend configuration for GCS
# Update bucket name with your actual GCS bucket name

bucket  = "your-terraform-state-bucket-name"
prefix  = "terraform/state"

# Optional: Enable encryption
# encryption_key = "base64-encoded-encryption-key"

# Optional: Enable versioning
# skip_bucket_versioning = false
