#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-frontend-bidmart:local-test}"

if [[ ! -f Dockerfile ]]; then
  echo "ERROR: Dockerfile is missing."
  exit 1
fi

if [[ ! -f nginx.conf ]]; then
  echo "ERROR: nginx.conf is missing."
  exit 1
fi

if ! grep -q "proxy_pass http://bidmart-api-gateway:8080;" nginx.conf; then
  echo "ERROR: nginx.conf must proxy /api/ to http://bidmart-api-gateway:8080;"
  exit 1
fi

docker build -t "$IMAGE_NAME" .

echo "OK: Frontend Docker image built as $IMAGE_NAME and proxies API traffic to bidmart-api-gateway."
