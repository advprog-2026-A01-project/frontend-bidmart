#!/usr/bin/env bash
set -euo pipefail

echo "==> Checking frontend API boundary"

if [[ ! -d src ]]; then
  echo "ERROR: src directory not found."
  exit 1
fi

violations=0

echo "==> Checking hardcoded localhost/internal service URLs in src/"
if grep -RIn \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.js' \
  --include='*.jsx' \
  -E 'localhost:8080|localhost:8081|localhost:8082|localhost:8083|127\.0\.0\.1|http://localhost|https://localhost' src; then
  echo "ERROR: Hardcoded localhost/internal URL found in frontend source."
  violations=1
fi

echo "==> Checking direct relative /api calls in src/"
if grep -RIn \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.js' \
  --include='*.jsx' \
  -E '(fetch|axios|get|post|put|patch|delete)[[:space:]]*\([[:space:]]*["'\'']\/api' src; then
  echo "ERROR: Direct relative /api call found. Use src/lib/apiClient.ts and VITE_API_BASE_URL instead."
  violations=1
fi

echo "==> Checking direct internal service ports in src/"
if grep -RIn \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.js' \
  --include='*.jsx' \
  -E ':8081|:8082|:8083|:9091|:5432|:5434' src; then
  echo "ERROR: Frontend source must not reference internal service/database/gRPC ports."
  violations=1
fi

if [[ "$violations" -ne 0 ]]; then
  echo "API boundary check failed."
  exit 1
fi

echo "OK: frontend API boundary is clean."
