terraform {
  backend "s3" {
    bucket         = "mexxicanmx-terraform-state-256663926988"
    key            = "github-oidc/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "mexxicanmx-terraform-locks"
    encrypt        = true
  }
}
