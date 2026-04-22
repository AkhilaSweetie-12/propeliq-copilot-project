project_name         = "propeliq"
project_id           = "propeliq-prod"
environment          = "prod"
region               = "us-east4"
network_cidr         = "10.90.1.0/24"
cloud_run_image      = "us-docker.pkg.dev/propeliq-prod/apps/api:release"
cloud_sql_tier       = "db-custom-4-15360"
cloud_sql_disk_size  = 500
deletion_protection  = true

labels = {
  owner      = "platform-team"
  data_class = "phi"
}