#!/usr/bin/env bash
# Run k6 load tests. Install: https://grafana.com/docs/k6/latest/set-up/install-k6/
set -euo pipefail

SCENARIO="${1:-smoke}"
TARGET="${K6_TARGET:-local}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$SCENARIO" in
  smoke) FILE="k6/scenarios/smoke.js" ;;
  dashboard) FILE="k6/scenarios/dashboard-100-users.js" ;;
  api) FILE="k6/scenarios/api-ingest.js" ;;
  ceiling) FILE="k6/scenarios/dashboard-ceiling.js" ;;
  *)
    echo "Usage: $0 [smoke|dashboard|api|ceiling]"
    exit 1
    ;;
esac

export K6_TARGET="$TARGET"
cd "$ROOT"

ARGS=(run "$FILE")
if [[ -n "${K6_SUMMARY_EXPORT:-}" ]]; then
  ARGS+=(--summary-export "$K6_SUMMARY_EXPORT")
fi

echo "k6 scenario=$SCENARIO target=$TARGET dir=$ROOT"
exec k6 "${ARGS[@]}"
