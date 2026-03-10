variable "aws_region" {
  description = "Primary AWS region for S3 and Route 53 managed resources."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short project identifier."
  type        = string
  default     = "xlb"
}

variable "domain_name" {
  description = "Fully qualified site domain."
  type        = string
  default     = "xlb.codemachine.in"
}

variable "zone_name" {
  description = "Existing Route 53 hosted zone name."
  type        = string
  default     = "codemachine.in"
}

variable "site_bucket_name" {
  description = "S3 bucket for the static site."
  type        = string
  default     = "xlb-codemachine-in-site"
}

variable "tags" {
  description = "Default tags applied to all resources."
  type        = map(string)
  default = {
    Project     = "xlb"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
