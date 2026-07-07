#!/usr/bin/env bash
# Build the frontend and publish it to the CloudFront-backed S3 bucket.
# Bucket and distribution come from the classyear-serverless stack outputs.
set -euo pipefail
cd "$(dirname "$0")"

STACK=classyear-serverless
BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)
DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" --output text)

if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
  echo "FrontendBucketName output not found on stack $STACK — deploy the SAM stack first." >&2
  exit 1
fi

npm run build
aws s3 sync dist "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' --query 'Invalidation.Id' --output text
echo "Frontend deployed to s3://$BUCKET (CloudFront invalidation started)"
