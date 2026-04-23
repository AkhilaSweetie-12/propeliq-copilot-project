variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "propeliq"
}

variable "environment" {
  description = "Environment (dev only for now)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev"], var.environment)
    error_message = "Only 'dev' environment is currently supported."
  }
}

variable "terraform_state_bucket" {
  description = "GCS bucket for Terraform state"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "propeliq_db"
}

variable "database_user" {
  description = "Database user"
  type        = string
  default     = "propeliq_user"
}

variable "notification_channels" {
  description = "List of notification channel IDs for alerts"
  type        = list(string)
  default     = []
}
