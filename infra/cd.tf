# Kept separate from aws-git and the policy shared with githubmexxican.
resource "aws_iam_role" "mexxicanmx_cd" {
  name = "mexxicanmx-ci-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_owner}@${var.github_owner_id}/${var.github_repo_name}@${var.github_repo_id}:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_ssm_document" "mexxicanmx_deploy" {
  name            = "MexxicanMX-DeployRelease"
  document_type   = "Command"
  document_format = "JSON"
  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Deploy or restore verified MexxicanMX container images"
    parameters = {
      ReleaseId   = { type = "String", allowedPattern = "^[a-f0-9]{40}/[0-9]+-[0-9]+$" }
      ImageSha256 = { type = "String", allowedPattern = "^[a-f0-9]{64}$" }
      Operation   = { type = "String", allowedValues = ["deploy", "rollback"] }
    }
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "deploy"
      inputs = { timeoutSeconds = "1800", runCommand = ["bash -s <<'MEXXICANMX_DEPLOY'\n${file("${path.module}/../deploy/ssm-deploy.sh")}\nMEXXICANMX_DEPLOY"] }
    }]
  })
}

resource "aws_iam_role_policy" "mexxicanmx_cd" {
  name = "mexxicanmx-release"
  role = aws_iam_role.mexxicanmx_cd.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReleaseArtifacts"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
        Resource = "arn:aws:s3:::oamdevsol-cfn-templates-256663926988/mexxicanmx/releases/*"
      },
      {
        Sid      = "StaticFrontendObjects"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = concat(["arn:aws:s3:::oamdevsol-restaurant-256663926988/index.html", "arn:aws:s3:::oamdevsol-restaurant-256663926988/releases/*", "arn:aws:s3:::oamdevsol-admin-256663926988/index.html", "arn:aws:s3:::oamdevsol-admin-256663926988/releases/*"], ["${aws_s3_bucket.diner.arn}/index.html", "${aws_s3_bucket.diner.arn}/releases/*"])
      },
      {
        Sid      = "RunOnlyDeploymentDocumentOnTarget"
        Effect   = "Allow"
        Action   = "ssm:SendCommand"
        Resource = [aws_ssm_document.mexxicanmx_deploy.arn, "arn:aws:ec2:us-east-1:256663926988:instance/i-000928567783f36af"]
      },
      { Sid = "CheckCommand", Effect = "Allow", Action = "ssm:GetCommandInvocation", Resource = "*" },
      {
        Sid      = "InvalidateKnownFrontends"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
        Resource = concat(["arn:aws:cloudfront::256663926988:distribution/E1K516ITL1YDZ3", "arn:aws:cloudfront::256663926988:distribution/E1NK74NZM8UYXZ"], [aws_cloudfront_distribution.diner.arn])
      }
    ]
  })
}
