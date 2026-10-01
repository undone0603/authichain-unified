#!/usr/bin/env bash
# worker-app/scripts/capacity-check.sh
#
# Item 2: Free-tier capacity audit before DNS cutover.
#
# Queries activity_log for 30-day request volume and compares against
# Cloudflare Workers free-tier limits. Prints a GO / NO-GO recommendation.
#
# Usage:
#   DATABASE_URL="postgresql://..." bash worker-app/scripts/capacity-check.sh
#
#   Or with Supabase psql:
#   PGPASSWORD="..." psql -h db.<project>.supabase.co -U postgres -d postgres \
#     -f worker-app/scripts/capacity-check.sql
#
# Cloudflare free-tier limits (as of 2026):
#   Workers requests   100,000 / day
#   KV reads           100,000 / day
#   KV writes           1,000 / day
#   Durable Objects   100,000 / day
#   DO storage           1 GB total
#
# If any day in the past 30 days exceeded 80% of a limit, this script prints
# a NO-GO and explains the cheapest upgrade path.

set -euo pipefail

WARN_THRESHOLD=80000   # 80% of 100k Workers requests/day

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Usage: DATABASE_URL='postgresql://...' bash $0"
  echo ""
  echo "Alternatively, copy the SQL below and run it directly in your"
  echo "Supabase SQL editor or psql:"
  echo ""
  cat <<'SQL'
-- Cloudflare free-tier capacity audit
-- Run in Supabase SQL editor or psql before DNS cutover

-- 1. Daily request volume (proxy: activity_log rows)
SELECT
  DATE(created_at AT TIME ZONE 'UTC') AS day,
  COUNT(*)                             AS log_rows,
  CASE
    WHEN COUNT(*) > 80000 THEN '🔴 EXCEEDS 80% free-tier — upgrade Workers plan'
    WHEN COUNT(*) > 50000 THEN '🟡 WATCH — approaching limit'
    ELSE                       '🟢 OK'
  END AS status
FROM activity_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 2. Peak day summary
SELECT
  MAX(daily_count)  AS peak_day_rows,
  AVG(daily_count)  AS avg_day_rows,
  CASE
    WHEN MAX(daily_count) > 80000
      THEN 'NO-GO: peak day exceeds 80k — upgrade to Workers Paid ($5/mo) first'
    WHEN MAX(daily_count) > 50000
      THEN 'CAUTION: peak approaches limit — monitor wrangler tail after cutover'
    ELSE
      'GO: traffic well within free tier'
  END AS recommendation
FROM (
  SELECT DATE(created_at AT TIME ZONE 'UTC'), COUNT(*) AS daily_count
  FROM activity_log
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
) t;
SQL
  exit 0
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo " Cloudflare free-tier capacity audit"
echo "══════════════════════════════════════════════════════"
echo ""

# Run the query
RESULT=$(psql "$DATABASE_URL" --no-psqlrc -t -A -F'|' <<'SQL' 2>/dev/null
SELECT
  MAX(daily_count)::int  AS peak,
  ROUND(AVG(daily_count))::int AS avg_daily
FROM (
  SELECT DATE(created_at AT TIME ZONE 'UTC'), COUNT(*) AS daily_count
  FROM activity_log
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
) t;
SQL
)

PEAK=$(echo "$RESULT" | cut -d'|' -f1)
AVG=$(echo "$RESULT" | cut -d'|' -f2)

echo "  Peak day (last 30d):    $PEAK requests"
echo "  Average day (last 30d): $AVG requests"
echo "  Free-tier limit:        100,000 requests/day"
echo "  Warning threshold:      $WARN_THRESHOLD requests/day (80%)"
echo ""

if [[ "$PEAK" -gt "$WARN_THRESHOLD" ]]; then
  echo -e "${RED}NO-GO: peak day ($PEAK) exceeds 80% of the free-tier limit.${NC}"
  echo ""
  echo "  Action: Upgrade to Workers Paid plan (\$5/mo) before DNS cutover."
  echo "  This gives you 10M requests/month with no hard quota wall."
  echo "  Command: visit dash.cloudflare.com → Workers & Pages → Your plan"
  exit 1
elif [[ "$PEAK" -gt 50000 ]]; then
  echo -e "${YELLOW}CAUTION: peak day ($PEAK) is above 50% of the limit.${NC}"
  echo ""
  echo "  Recommendation: Monitor 'npx wrangler tail' closely after cutover."
  echo "  If a spike exceeds 100k, requests will return HTTP 1101."
  echo "  Consider upgrading to Workers Paid (\$5/mo) as a safety buffer."
  echo ""
  echo -e "${GREEN}GO (with monitoring): Proceed to deployment.${NC}"
else
  echo -e "${GREEN}GO: Traffic is well within Cloudflare free-tier limits.${NC}"
fi

echo ""
echo "  Note: This uses activity_log rows as a proxy for HTTP requests."
echo "  Actual Workers requests may be higher (static assets, preflight"
echo "  CORS, health checks). Add ~20% buffer to the numbers above."
echo "══════════════════════════════════════════════════════"
