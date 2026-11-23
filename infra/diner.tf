resource "aws_s3_bucket" "diner" {
  bucket = "oamdevsol-diner-256663926988"
}

resource "aws_s3_bucket_public_access_block" "diner" {
  bucket                  = aws_s3_bucket.diner.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "diner" {
  bucket = aws_s3_bucket.diner.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_cloudfront_origin_access_control" "diner" {
  name                              = "mexxicanmx-diner-oac"
  description                       = "Private S3 origin for the diner SPA"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "diner" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = ["menu.oamdevsol.site"]
  origin {
    domain_name              = aws_s3_bucket.diner.bucket_regional_domain_name
    origin_id                = "diner-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.diner.id
  }
  default_cache_behavior {
    target_origin_id       = "diner-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 31536000
  }
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:256663926988:certificate/2e2ec23a-21e1-4c8b-bdbb-9c4a6f1d211b"
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

resource "aws_s3_bucket_policy" "diner" {
  bucket = aws_s3_bucket.diner.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowOnlyDinerCloudFront"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.diner.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.diner.arn } }
    }]
  })
}
