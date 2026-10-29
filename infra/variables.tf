variable "aws_region" {
  description = "Región de AWS para desplegar recursos"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "Repositorio de GitHub en formato owner/repo"
  type        = string
  default     = "osbaldoXxC/menus-qr-Negocios"
}

variable "role_name" {
  description = "Nombre del rol de IAM para GitHub Actions"
  type        = string
  default     = "aws-git"
}
