#!/usr/bin/env bash
# Runs all six load test levels in sequence.
# Reseeds the database before each run so every level starts clean.
#
# Prerequisites:
#   - k6 installed: https://k6.io/docs/getting-started/installation/
#   - Backend running locally: cd backend && npm run dev
#   - Or set BASE_URL to your staging deployment
#
# Usage:
#   chmod +x tests/load/run-all-levels.sh
#   BASE_URL=https://your-staging.vercel.app ./tests/load/run-all-levels.sh

BASE_URL="${BASE_URL:-http://localhost:3001}"
SCRIPT="tests/load/full-scenario.js"
RESULTS_DIR="tests/load/results"

mkdir -p "$RESULTS_DIR"

echo "Atlanta Tennis Load Tests"
echo "Target: $BASE_URL"
echo ""

for VUS in 25 50 75 100 150 500; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶  Reseed database for VUS=$VUS run…"
  (cd "$(dirname "$0")/../.." && npm run seed)

  echo "▶  Running k6 at VUS=$VUS…"
  k6 run \
    -e BASE_URL="$BASE_URL" \
    -e VUS="$VUS" \
    -e DURATION="90s" \
    --out json="$RESULTS_DIR/vus-${VUS}.json" \
    --summary-export="$RESULTS_DIR/summary-vus-${VUS}.json" \
    "$SCRIPT"

  echo "✅  VUS=$VUS complete. Results → $RESULTS_DIR/summary-vus-${VUS}.json"
  echo ""
done

echo "All levels complete. Results in $RESULTS_DIR/"
