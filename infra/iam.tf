resource "aws_iam_role" "github_actions" {
  name = "aws-git"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:osbaldoXxC/menus-qr-Negocios:ref:refs/heads/main"
        }
      }
    }]
  })
}

resource "aws_iam_policy" "github_actions_deploy" {
  name        = "mexxicanmx-github-actions-deploy"
  description = "Permisos minimos: deploy de frontends (S3+CloudFront) y backend (SSM a EC2)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3FrontendDeploy"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::oamdevsol-restaurant-256663926988",
          "arn:aws:s3:::oamdevsol-restaurant-256663926988/*",
          "arn:aws:s3:::oamdevsol-admin-256663926988",
          "arn:aws:s3:::oamdevsol-admin-256663926988/*",
          "arn:aws:s3:::oamdevsol-cfn-templates-256663926988",
          "arn:aws:s3:::oamdevsol-cfn-templates-256663926988/*"
        ]
      },
      {
        Sid      = "CloudFrontInvalidation"
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = "*"
      },
      {
        Sid    = "SSMDeployToBackendEC2"
        Effect = "Allow"
        Action = "ssm:SendCommand"
        Resource = [
          "arn:aws:ec2:us-east-1:256663926988:instance/i-000928567783f36af",
          "arn:aws:ssm:us-east-1::document/AWS-RunShellScript"
        ]
      },
      {
        Sid    = "SSMCommandStatusAndInfo"
        Effect = "Allow"
        Action = [
          "ssm:GetCommandInvocation",
          "ssm:DescribeInstanceInformation"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_attach" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_deploy.arn
}
