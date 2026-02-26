variable "billing_account" {
  description = "GCP billing account ID (XXXXXX-XXXXXX-XXXXXX)"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-northeast1"
}

variable "owner_email" {
  description = "Gmail address for IAP access (e.g. user@gmail.com)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (owner/name)"
  type        = string
  default     = "tkmain-dev/self-os"
}

variable "image_tag" {
  description = "Initial container image tag"
  type        = string
  default     = "latest"
}
