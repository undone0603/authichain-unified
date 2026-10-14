echo "=== 1. GIT BASELINE ==="
git status
git branch -vv

echo "=== 2. D1 / WRANGLER CONFIG & WORKFLOWS ==="
grep -rn "d1" .github/workflows/ wrangler.toml workers/ || true
grep -rn "7403" .github/ || true
grep -rn "D1" .github/workflows/ || true

echo "=== 3. STRIPE WEBHOOK ==="
find . -name "*stripe*" -o -name "*webhook*"
find apps workers -name "route.ts" -o -name "route.js" -o -name "*.ts" | grep -i stripe || true

echo "=== 4. AGENT IDENTITY & OUTBOUND SCHEMA ==="
find . -name "agent-outbound.sql" -o -name "*outbound*" -o -name "*agent*" | grep -E "schema|agent" || true

