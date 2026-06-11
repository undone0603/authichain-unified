#!/usr/bin/env bash
# Flagship (app.authichain.com) purchase-path audit — read-only.
# 1) Are the 3 subscriptionPlans.ts payment links live?
# 2) Does the DEPLOYED JS bundle actually contain them (SPA = static HTML misses them)?
set -u

echo "=== 1. subscriptionPlans.ts payment links liveness ==="
links=(
"starter-49mo|https://buy.stripe.com/7sY00j87n5xcfWObDC1Nu3r"
"professional-199mo|https://buy.stripe.com/28E4gzbjze3I7qi4ba1Nu3s"
"enterprise-799mo|https://buy.stripe.com/6oU5kDfzP7Fk6medLK1Nu3t"
)
for entry in "${links[@]}"; do
  name="${entry%%|*}"; url="${entry#*|}"
  body=$(curl -s -m 15 -L "$url")
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -L "$url")
  if echo "$body" | grep -qiE "no longer available|link is (currently )?unavailable|Something went wrong"; then
    state="DEAD"
  elif [ "$code" = "200" ]; then
    title=$(echo "$body" | grep -oP '(?<=<title>)[^<]*' | head -1)
    state="LIVE | $title"
  else
    state="HTTP $code"
  fi
  printf "%-22s %s\n" "$name" "$state"
done

echo
echo "=== 2. deployed bundle on app.authichain.com ==="
html=$(curl -s -m 20 -L "https://app.authichain.com/")
# pull all script/asset references
assets=$(echo "$html" | grep -oE '/assets/[A-Za-z0-9_.-]+\.js' | sort -u)
echo "asset JS files referenced in index.html:"
echo "$assets" | sed 's/^/  /'
echo
total_hits=0
for a in $assets; do
  js=$(curl -s -m 30 -L "https://app.authichain.com$a")
  size=${#js}
  hits=$(echo "$js" | grep -oE 'buy\.stripe\.com/[A-Za-z0-9]+' | sort -u)
  n=$(echo -n "$hits" | grep -c . || true)
  echo "--- $a (${size} bytes) buy-links: $n"
  [ -n "$hits" ] && echo "$hits" | sed 's/^/    /'
  total_hits=$((total_hits + n))
done
echo
echo "TOTAL distinct buy.stripe.com refs in deployed bundle: $total_hits"

echo
echo "=== 3. does deployed bundle reference checkout API instead? ==="
for a in $assets; do
  js=$(curl -s -m 30 -L "https://app.authichain.com$a")
  echo "--- $a"
  echo "$js" | grep -oE '(create-checkout|checkout[._-]?session|/api/(stripe|checkout|billing)[A-Za-z/_-]*)' | sort -u | head -10 | sed 's/^/    /'
done
