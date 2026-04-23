output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "vpc_network_name" {
  description = "VPC Network name"
  value       = google_compute_network.vpc_network.name
}

output "private_subnet_name" {
  description = "Private subnet name"
  value       = google_compute_subnetwork.private_subnet.name
}

output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.postgres_instance.name
}

output "database_instance_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.postgres_instance.private_ip_address
}

output "frontend_service_url" {
  description = "Cloud Run frontend service URL"
  value       = google_cloud_run_service.frontend.status[0].url
}

output "backend_service_url" {
  description = "Cloud Run backend service URL"
  value       = google_cloud_run_service.backend.status[0].url
}

output "storage_bucket_name" {
  description = "Cloud Storage bucket name"
  value       = google_storage_bucket.file_storage.name
}

output "kms_key_name" {
  description = "KMS key name"
  value       = google_kms_crypto_key.data_encryption_key.id
}

output "secret_manager_connection_string" {
  description = "Secret Manager secret ID for connection string"
  value       = google_secret_manager_secret.db_connection_string.secret_id
}

output "service_account_email" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloud_run_sa.email
}

output "terraform_state_bucket" {
  description = "Terraform state bucket name"
  value       = var.terraform_state_bucket
}
