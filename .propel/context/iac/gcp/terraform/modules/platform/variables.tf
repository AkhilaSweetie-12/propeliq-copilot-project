variable "project_name" {
  type = string
}

variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "network_cidr" {
  type = string
}

variable "cloud_run_image" {
  type = string
}

variable "cloud_sql_tier" {
  type = string
}

variable "cloud_sql_disk_size" {
  type = number
}

variable "deletion_protection" {
  type = bool
}

variable "labels" {
  type    = map(string)
  default = {}
}
