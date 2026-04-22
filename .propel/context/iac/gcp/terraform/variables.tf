variable "project_name" {
  description = "Project/application identifier."
  type        = string
}

variable "project_id" {
  description = "GCP project ID."
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
}

variable "region" {
  description = "GCP region."
  type        = string
}

variable "network_cidr" {
  description = "Primary subnet CIDR."
  type        = string
}

variable "cloud_run_image" {
  description = "Container image for Cloud Run service."
  type        = string
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier."
  type        = string
}

variable "cloud_sql_disk_size" {
  description = "Cloud SQL disk size in GB."
  type        = number
}

variable "deletion_protection" {
  description = "Enable deletion protection for critical resources."
  type        = bool
  default     = true
}

variable "labels" {
  description = "Common resource labels."
  type        = map(string)
  default     = {}
}
