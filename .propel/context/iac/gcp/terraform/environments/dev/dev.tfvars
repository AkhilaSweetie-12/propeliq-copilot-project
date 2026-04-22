project_name         = "propeliq"
project_id           = "propeliq-dev"
environment          = "dev"
region               = "us-central1"
network_cidr         = "10.70.1.0/24"
cloud_run_image      = "us-docker.pkg.dev/propeliq-dev/apps/api:latest"
cloud_sql_tier       = "db-custom-2-7680"
cloud_sql_disk_size  = 100
deletion_protection  = false

labels = {
  owner      = "platform-team"
  data_class = "phi"
}