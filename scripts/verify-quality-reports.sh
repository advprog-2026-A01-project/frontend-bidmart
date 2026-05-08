#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "reports/eslint-report.json"
  "dist/index.html"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: required frontend quality artifact is missing: $file"
    exit 1
  fi
done

echo "OK: all required frontend quality artifacts are available."
