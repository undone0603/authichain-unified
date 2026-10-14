echo "--- D1 WORKFLOWS ---"
grep -rn "7403" .github/ || echo "No 7403 found directly in text"
grep -rn "d1" .github/workflows/

echo "--- STRIPE WEBHOOK IMPLEMENTATION ---"
cat apps/qron-platform/src/app/api/stripe/webhook/route.ts || cat src/app/api/stripe/webhook/route.ts || cat src/app/api/webhooks/stripe/route.ts || true

echo "--- AGENT IDENTITY & OUTBOUND SCHEMA ---"
find . -name "*outbound*" -o -name "*agent*" | grep -E "schema|agent"
