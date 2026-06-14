#!/usr/bin/env bash
# Find lazy-loaded chunks in the deployed flagship bundle and grep them for buy links.
set -u
base="https://app.authichain.com"
js=$(curl -s -m 30 -L "$base/assets/index-GMZb8yuS.js")
echo "entry bundle bytes: ${#js}"
chunks=$(echo "$js" | grep -oE 'assets/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8}\.js' | sort -u)
n=$(echo "$chunks" | grep -c . || true)
echo "lazy chunks referenced: $n"
found=0
for c in $chunks; do
  body=$(curl -s -m 30 -L "$base/$c")
  hits=$(echo "$body" | grep -oE 'buy\.stripe\.com/[A-Za-z0-9]+' | sort -u)
  if [ -n "$hits" ]; then
    echo "HIT in $c:"
    echo "$hits" | sed 's/^/    /'
    found=1
  fi
done
[ "$found" = "0" ] && echo "NO buy.stripe.com refs in any chunk"

# also check whether a Pricing chunk exists at all, and what it contains for purchase
echo
echo "=== pricing-named chunks ==="
for c in $chunks; do
  case "$c" in
    *ricing*|*ubscri*|*heckout*|*illing*|*ayment*)
      body=$(curl -s -m 30 -L "$base/$c")
      echo "--- $c (${#body} bytes)"
      echo "$body" | grep -oE '(buy\.stripe\.com/[A-Za-z0-9]+|paymentLink|Buy Now|Get Started|contact sales|mailto:[^"]+)' | sort -u | head -15 | sed 's/^/    /'
      ;;
  esac
done

echo
echo "=== deployment freshness: when was this bundle deployed? ==="
curl -sI -m 15 "$base/assets/index-GMZb8yuS.js" | grep -iE '^(last-modified|age|x-vercel|etag|date):'
