output "project_id" {
  description = "GCP project ID"
  value       = google_project.app.project_id
}

output "region" {
  description = "GCP region"
  value       = var.region
}

output "lb_ip" {
  description = "Load balancer IP address"
  value       = google_compute_global_address.default.address
}

output "app_url" {
  description = "Application URL"
  value       = "https://${local.ip_domain}"
}

output "artifact_registry_repo" {
  description = "Artifact Registry image path"
  value       = "${var.region}-docker.pkg.dev/${google_project.app.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "workload_identity_provider" {
  description = "Workload Identity Federation provider name for GitHub Actions"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "github_actions_sa_email" {
  description = "GitHub Actions service account email"
  value       = google_service_account.github_actions.email
}
