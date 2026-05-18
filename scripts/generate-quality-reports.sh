#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports

bash scripts/check-api-boundary.sh
npm run lint -- --format json --output-file reports/eslint-report.json
npm run build
bash scripts/verify-netlify-build.sh

echo "OK: frontend lint report, API boundary check, Netlify config, and build output generated."
