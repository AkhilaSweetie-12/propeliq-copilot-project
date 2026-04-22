locals {
  common_labels = merge(var.labels, {
    project     = var.project_name
    environment = var.environment
    managed_by  = "terraform"
  })
}

module "platform" {
  source = "./modules/platform"

  project_name         = var.project_name
  project_id           = var.project_id
  environment          = var.environment
  region               = var.region
  network_cidr         = var.network_cidr
  cloud_run_image      = var.cloud_run_image
  cloud_sql_tier       = var.cloud_sql_tier
  cloud_sql_disk_size  = var.cloud_sql_disk_size
  deletion_protection  = var.deletion_protection
  labels               = local.common_labels
}
