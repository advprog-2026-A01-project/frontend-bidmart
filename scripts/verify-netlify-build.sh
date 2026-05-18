#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "netlify.toml"
  "dist/index.html"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: required Netlify artifact/config is missing: $file"
    exit 1
  fi
done

if ! grep -q 'publish = "dist"' netlify.toml; then
  echo "ERROR: netlify.toml must publish dist directory."
  exit 1
fi

if ! grep -q 'command = "npm run build"' netlify.toml; then
  echo "ERROR: netlify.toml must use npm run build."
  exit 1
fi

echo "OK: Netlify build config and dist artifact are valid."
