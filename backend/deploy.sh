#!/usr/bin/env bash
# Build the Lambda bundle and deploy the classyear-serverless SAM stack.
# Equivalent to `npm run sam:build && npm run sam:deploy`, documented here as
# a single entry point (mirrors frontend/deploy.sh).
set -euo pipefail
cd "$(dirname "$0")"

npm run sam:build
npm run sam:deploy

echo "Backend deployed (see stack outputs above for the API endpoint)"
