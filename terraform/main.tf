terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  backend "gcs" {
    bucket = var.terraform_state_bucket
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Random ID for unique resource naming
resource "random_id" "suffix" {
  byte_length = 4
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "${var.project_name}-vpc-${random_id.suffix.hex}"
  auto_create_subnetworks = false
}

# Private subnet for Cloud SQL
resource "google_compute_subnetwork" "private_subnet" {
  name          = "${var.project_name}-private-subnet-${random_id.suffix.hex}"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc_network.id
  
  private_ip_google_access = true
  
  secondary_ip_range {
    range_name    = "${var.project_name}-pods-${random_id.suffix.hex}"
    ip_cidr_range = "10.1.0.0/16"
  }
  
  secondary_ip_range {
    range_name    = "${var.project_name}-services-${random_id.suffix.hex}"
    ip_cidr_range = "10.2.0.0/16"
  }
}

# Cloud Router for private IP access
resource "google_compute_router" "router" {
  name    = "${var.project_name}-router-${random_id.suffix.hex}"
  region  = var.region
  network = google_compute_network.vpc_network.id
}

# NAT Gateway for internet access
resource "google_compute_router_nat" "nat" {
  name                               = "${var.project_name}-nat-${random_id.suffix.hex}"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocation_option           = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# Service account for Cloud Run
resource "google_service_account" "cloud_run_sa" {
  account_id   = "${var.project_name}-cloud-run-sa-${random_id.suffix.hex}"
  display_name = "Cloud Run Service Account"
}

# IAM permissions for Cloud Run service account
resource "google_project_iam_member" "cloud_run_iam" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/cloudkms.cryptoKeyDecrypter",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Cloud SQL instance
resource "google_sql_database_instance" "postgres_instance" {
  name             = "${var.project_name}-postgres-${random_id.suffix.hex}"
  database_version = "POSTGRES_16"
  region           = var.region
  
  settings {
    tier = "db-custom-4-16384"
    
    ip_configuration {
      ipv4_enabled = false
      private_network = google_compute_network.vpc_network.id
      require_ssl = true
    }
    
    backup_configuration {
      enabled = true
      location = var.region
    }
    
    maintenance_window {
      day          = 1  # Monday
      hour         = 2
      update_track = "stable"
    }
    
    database_flags {
      name  = "pgvector"
      value = "on"
    }
    
    database_flags {
      name  = "log_statement"
      value = "all"
    }
  }
  
  deletion_protection = false
}

# Cloud SQL database
resource "google_sql_database" "app_database" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres_instance.name
}

# Cloud SQL user
resource "google_sql_user" "app_user" {
  name     = var.database_user
  instance = google_sql_database_instance.postgres_instance.name
  password = random_password.db_password.result
}

# Random password for database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store database credentials in Secret Manager
resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "${var.project_name}-db-connection-string-${random_id.suffix.hex}"
  
  replication {
    automatic = true
  }
}

resource "google_secret_manager_secret_version" "db_connection_string_version" {
  secret      = google_secret_manager_secret.db_connection_string.id
  secret_data = "Host=${google_sql_database_instance.postgres_instance.private_ip_address};Port=5432;Database=${google_sql_database.app_database.name};Username=${google_sql_user.app_user.name};Password=${random_password.db_password.result};SSL Mode=Require;"
  
  annotations = {
    description = "Database connection string for PropelIQ application"
  }
}

# KMS Key Ring
resource "google_kms_key_ring" "key_ring" {
  name     = "${var.project_name}-key-ring-${random_id.suffix.hex}"
  location = var.region
}

# KMS Key for data encryption
resource "google_kms_crypto_key" "data_encryption_key" {
  name     = "${var.project_name}-data-key-${random_id.suffix.hex}"
  key_ring = google_kms_key_ring.key_ring.id
  
  purpose = "ENCRYPT_DECRYPT"
  
  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
  
  rotation_period = "7776000s"  # 90 days
  
  lifecycle {
    prevent_destroy = true
  }
}

# Grant Cloud Run service account access to KMS key
resource "google_kms_crypto_key_iam_member" "key_access" {
  crypto_key_id = google_kms_crypto_key.data_encryption_key.id
  role          = "roles/cloudkms.cryptoKeyDecrypter"
  member        = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Cloud Run service for Frontend
resource "google_cloud_run_service" "frontend" {
  name     = "${var.project_name}-frontend-${random_id.suffix.hex}"
  location = var.region
  
  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/propeliq-frontend:latest"
        
        ports {
          container_port = 80
        }
        
        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
          requests = {
            cpu    = "0.5"
            memory = "256Mi"
          }
        }
        
        env {
          name  = "NODE_ENV"
          value = var.environment
        }
        
        env {
          name  = "KMS_KEY_NAME"
          value = google_kms_crypto_key.data_encryption_key.id
        }
      }
      
      service_account_name = google_service_account.cloud_run_sa.email
      
      timeout_seconds = 300
      
      container_concurrency = 80
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"        = "100"
        "autoscaling.knative.dev/minScale"        = "0"
        "run.googleapis.com/cpu-throttling"        = "true"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [
    google_project_iam_member.cloud_run_iam
  ]
}

# Cloud Run service for Backend API
resource "google_cloud_run_service" "backend" {
  name     = "${var.project_name}-api-${random_id.suffix.hex}"
  location = var.region
  
  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/propeliq-backend:latest"
        
        ports {
          container_port = 8080
        }
        
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
          requests = {
            cpu    = "1"
            memory = "1Gi"
          }
        }
        
        env {
          name  = "ASPNETCORE_ENVIRONMENT"
          value = var.environment
        }
        
        env {
          name = "CONNECTION_STRING"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.db_connection_string.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name  = "KMS_KEY_NAME"
          value = google_kms_crypto_key.data_encryption_key.id
        }
        
        env {
          name  = "PROJECT_ID"
          value = var.project_id
        }
      }
      
      service_account_name = google_service_account.cloud_run_sa.email
      
      timeout_seconds = 300
      
      container_concurrency = 80
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"        = "20"
        "autoscaling.knative.dev/minScale"        = "0"
        "run.googleapis.com/cpu-throttling"        = "true"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [
    google_project_iam_member.cloud_run_iam
  ]
}

# IAM policy for Cloud Run services (public access)
resource "google_cloud_run_service_iam_member" "frontend_public" {
  location = google_cloud_run_service.frontend.location
  project  = google_cloud_run_service.frontend.project
  service  = google_cloud_run_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "backend_public" {
  location = google_cloud_run_service.backend.location
  project  = google_cloud_run_service.backend.project
  service  = google_cloud_run_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Storage bucket for file uploads
resource "google_storage_bucket" "file_storage" {
  name          = "${var.project_name}-files-${random_id.suffix.hex}"
  location      = var.region
  storage_class = "STANDARD"
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Grant Cloud Run service account access to storage
resource "google_storage_bucket_iam_member" "storage_access" {
  bucket = google_storage_bucket.file_storage.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Log-based metrics for monitoring
resource "google_logging_metric" "error_count" {
  name   = "${var.project_name}-error-count-${random_id.suffix.hex}"
  filter = "resource.type=\"cloud_run_revision\" AND severity=\"ERROR\""
  
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    display_name = "${var.project_name} Error Count"
  }
}

resource "google_logging_metric" "response_time" {
  name   = "${var.project_name}-response-time-${random_id.suffix.hex}"
  filter = "resource.type=\"cloud_run_revision\" AND jsonPayload.latency"
  
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    display_name = "${var.project_name} Response Time"
  }
}

# Alert policies
resource "google_monitoring_alert_policy" "error_rate_alert" {
  display_name = "${var.project_name} High Error Rate"
  combiner     = "OR"
  
  conditions {
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.error_count.name}\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }
  
  notification_channels = var.notification_channels
  
  documentation {
    content = "High error rate detected in ${var.project_name} services. Check logs and service health."
  }
}
