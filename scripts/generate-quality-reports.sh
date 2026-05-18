#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports

npm run lint -- --format json --output-file reports/eslint-report.json
npm run build

echo "OK: frontend lint report and build output generated."
