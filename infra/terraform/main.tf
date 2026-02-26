################################################################################
# 1. Project & APIs
################################################################################

resource "random_id" "project_suffix" {
  byte_length = 4
  keepers     = { purpose = "project-id" }
}

resource "google_project" "app" {
  name            = "Techo App"
  project_id      = "techo-app-${random_id.project_suffix.hex}"
  billing_account = var.billing_account
  deletion_policy = "DELETE"
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "iap.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "secretmanager.googleapis.com",
    "sts.googleapis.com",
    "iamcredentials.googleapis.com",
  ])
  project            = google_project.app.project_id
  service            = each.key
  disable_on_destroy = false
  depends_on         = [google_project.app]
}

################################################################################
# 2. Artifact Registry
################################################################################

resource "google_artifact_registry_repository" "app" {
  project       = google_project.app.project_id
  location      = var.region
  repository_id = "techo-repo"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

################################################################################
# 3. Cloud Storage (SQLite persistence)
################################################################################

resource "google_storage_bucket" "sqlite" {
  project                     = google_project.app.project_id
  name                        = "${google_project.app.project_id}-sqlite"
  location                    = var.region
  uniform_bucket_level_access = true
  depends_on                  = [google_project_service.apis]
}

################################################################################
# 4. Service Accounts
################################################################################

# Cloud Run SA
resource "google_service_account" "cloudrun" {
  project      = google_project.app.project_id
  account_id   = "techo-cloudrun"
  display_name = "Techo Cloud Run SA"
  depends_on   = [google_project_service.apis]
}

# GCS access for Cloud Run SA
resource "google_storage_bucket_iam_member" "cloudrun_gcs" {
  bucket = google_storage_bucket.sqlite.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.cloudrun.email}"
}

# GitHub Actions SA
resource "google_service_account" "github_actions" {
  project      = google_project.app.project_id
  account_id   = "techo-github-actions"
  display_name = "Techo GitHub Actions SA"
  depends_on   = [google_project_service.apis]
}

# GitHub Actions SA permissions
resource "google_project_iam_member" "github_actions_run" {
  project = google_project.app.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_ar" {
  project = google_project.app.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_sa_user" {
  project = google_project.app.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

################################################################################
# 5. Workload Identity Federation (GitHub Actions)
################################################################################

resource "google_iam_workload_identity_pool" "github" {
  project                   = google_project.app.project_id
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = google_project.app.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == '${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

################################################################################
# 6. Cloud Run v2 Service
################################################################################

resource "google_cloud_run_v2_service" "app" {
  project  = google_project.app.project_id
  name     = "techo-app"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${google_project.app.project_id}/techo-repo/techo-app:${var.image_tag}"

      ports {
        container_port = 3001
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "DB_PATH"
        value = "/data/techo.db"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      volume_mounts {
        name       = "sqlite-data"
        mount_path = "/data"
      }
    }

    volumes {
      name = "sqlite-data"
      gcs {
        bucket    = google_storage_bucket.sqlite.name
        read_only = false
      }
    }
  }

  depends_on = [
    google_project_service.apis,
    google_service_account.cloudrun,
    google_storage_bucket_iam_member.cloudrun_gcs,
  ]
}


################################################################################
# 7. Application Load Balancer
################################################################################

resource "google_compute_global_address" "default" {
  project    = google_project.app.project_id
  name       = "techo-app-ip"
  depends_on = [google_project_service.apis]
}

# sslip.io domain derived from the static IP (e.g. 34-1-2-3.sslip.io)
locals {
  ip_domain = "${replace(google_compute_global_address.default.address, ".", "-")}.sslip.io"
}

resource "google_compute_managed_ssl_certificate" "default" {
  project = google_project.app.project_id
  name    = "techo-app-cert"
  managed {
    domains = [local.ip_domain]
  }
}

resource "google_compute_region_network_endpoint_group" "cloudrun_neg" {
  project               = google_project.app.project_id
  name                  = "techo-app-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.app.name
  }
  depends_on = [google_project_service.apis]
}

resource "google_compute_backend_service" "default" {
  project               = google_project.app.project_id
  name                  = "techo-app-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"

  backend {
    group = google_compute_region_network_endpoint_group.cloudrun_neg.id
  }

  depends_on = [google_project_service.apis]
}

resource "google_compute_url_map" "default" {
  project         = google_project.app.project_id
  name            = "techo-app-url-map"
  default_service = google_compute_backend_service.default.id
}

resource "google_compute_target_https_proxy" "default" {
  project          = google_project.app.project_id
  name             = "techo-app-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

resource "google_compute_global_forwarding_rule" "default" {
  project               = google_project.app.project_id
  name                  = "techo-app-forwarding-rule"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.default.id
  port_range            = "443"
  target                = google_compute_target_https_proxy.default.id
}

# HTTP -> HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  project = google_project.app.project_id
  name    = "techo-app-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "http_redirect" {
  project = google_project.app.project_id
  name    = "techo-app-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  project               = google_project.app.project_id
  name                  = "techo-app-http-forwarding"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.default.id
  port_range            = "80"
  target                = google_compute_target_http_proxy.http_redirect.id
}

################################################################################
# 8. Cloud Run IAM (allow LB to invoke Cloud Run)
################################################################################

resource "google_cloud_run_v2_service_iam_member" "lb_invoker" {
  project  = google_cloud_run_v2_service.app.project
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
