project_name         = "propeliq"
project_id           = "propeliq-staging"
environment          = "staging"
region               = "us-east1"
network_cidr         = "10.80.1.0/24"
cloud_run_image      = "us-docker.pkg.dev/propeliq-staging/apps/api:stable"
cloud_sql_tier       = "db-custom-2-7680"
cloud_sql_disk_size  = 200
deletion_protection  = true

labels = {
  owner      = "platform-team"
  data_class = "phi"
}