output "vpc_name" {
  value       = module.platform.vpc_name
  description = "VPC network name."
}

output "cloud_run_service" {
  value       = module.platform.cloud_run_service
  description = "Cloud Run service name."
}

output "cloud_sql_instance" {
  value       = module.platform.cloud_sql_instance
  description = "Cloud SQL instance name."
}

output "service_account_email" {
  value       = module.platform.service_account_email
  description = "Runtime service account email."
}
