resource "google_project_service" "required" {
  for_each = toset([
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com"
  ])

  project = var.project_id
  service = each.value
}

resource "google_compute_network" "this" {
  name                    = "${var.project_name}-${var.environment}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "app" {
  name          = "${var.project_name}-${var.environment}-app-subnet"
  ip_cidr_range = var.network_cidr
  region        = var.region
  network       = google_compute_network.this.id
  project       = var.project_id

  private_ip_google_access = true
}

resource "google_compute_global_address" "private_service_range" {
  name          = "${var.project_name}-${var.environment}-svc-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.this.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
}

resource "google_service_account" "runtime" {
  account_id   = substr(replace("${var.project_name}-${var.environment}-runtime", "_", "-"), 0, 30)
  display_name = "${var.project_name} ${var.environment} runtime service account"
  project      = var.project_id
}

resource "google_sql_database_instance" "this" {
  name                = "${var.project_name}-${var.environment}-pg"
  database_version    = "POSTGRES_16"
  region              = var.region
  project             = var.project_id
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.cloud_sql_tier
    disk_size         = var.cloud_sql_disk_size
    disk_type         = "PD_SSD"
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.this.id
      ssl_mode        = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = false
    }

    user_labels = var.labels
  }

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

resource "google_cloud_run_v2_service" "api" {
  name     = "${var.project_name}-${var.environment}-api"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.runtime.email

    containers {
      image = var.cloud_run_image

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }
    }
  }

  labels = var.labels

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "app_config" {
  secret_id = "${var.project_name}-${var.environment}-app-config"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_kms_key_ring" "this" {
  name     = "${var.project_name}-${var.environment}-kr"
  location = var.region
  project  = var.project_id
}

resource "google_kms_crypto_key" "this" {
  name            = "${var.project_name}-${var.environment}-cmk"
  key_ring        = google_kms_key_ring.this.id
  rotation_period = "7776000s"

  lifecycle {
    prevent_destroy = true
  }
}
