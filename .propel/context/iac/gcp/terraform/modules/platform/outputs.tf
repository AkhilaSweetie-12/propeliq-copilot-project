output "vpc_name" {
  value = google_compute_network.this.name
}

output "cloud_run_service" {
  value = google_cloud_run_v2_service.api.name
}

output "cloud_sql_instance" {
  value = google_sql_database_instance.this.name
}

output "service_account_email" {
  value = google_service_account.runtime.email
}
