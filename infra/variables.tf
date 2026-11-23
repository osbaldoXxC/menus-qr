variable "aws_region" {
  description = "Región de AWS para desplegar recursos"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "Repositorio de GitHub en formato owner/repo"
  type        = string
  default     = "osbaldoXxC/menus-qr"
}

variable "role_name" {
  description = "Nombre del rol de IAM para GitHub Actions"
  type        = string
  default     = "aws-git"
}

variable "github_owner" {
  description = "Nombre del propietario de GitHub"
  type        = string
  default     = "osbaldoXxC"
}

variable "github_owner_id" {
  description = "Identificador inmutable del propietario de GitHub"
  type        = string
  default     = "159576324"
}

variable "github_repo_name" {
  description = "Nombre del repositorio de GitHub"
  type        = string
  default     = "menus-qr"
}

variable "github_repo_id" {
  description = "Identificador inmutable del repositorio de GitHub"
  type        = string
  default     = "1382412224"
}

variable "diner_bucket_name" {
  description = "Bucket S3 existente para comensales; debe configurarse antes del despliegue"
  type        = string
  default     = ""
}

variable "diner_distribution_id" {
  description = "Distribución CloudFront existente para comensales"
  type        = string
  default     = ""
}
