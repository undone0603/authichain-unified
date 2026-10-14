import os, glob

print("=================== SUMMARY INVESTIGATION ===================")

# 1. Branch & Status
print("\n--- 1. BRANCH & STATUS ---")
os.system("git branch --show-current")
os.system("git status --short")

# 2. Workflows & D1
print("\n--- 2. CLOUDFLARE D1 WORKFLOWS & CONFIG ---")
for w in glob.glob(".github/workflows/*.yml") + glob.glob(".github/workflows/*.yaml"):
    with open(w) as f:
        txt = f.read()
        if "d1" in txt.lower() or "wrangler" in txt.lower() or "7403" in txt:
            print(f"Workflow file: {w}")
            for line in txt.splitlines():
                if any(k in line.lower() for k in ["d1", "wrangler", "7403", "cloudflare_api_token", "account_id"]):
                    print("  ", line.strip())

print("\n--- Wrangler TOML D1 Configs ---")
for w in glob.glob("**/wrangler.toml", recursive=True):
    with open(w) as f:
        txt = f.read()
        if "d1_databases" in txt:
            print(f"Wrangler file: {w}")
            for line in txt.splitlines():
                if any(k in line.lower() for k in ["d1_databases", "binding", "database_name", "database_id"]):
                    print("  ", line.strip())

# 3. Stripe Webhook
print("\n--- 3. STRIPE WEBHOOK IMPLEMENTATION ---")
stripe_files = glob.glob("**/stripe/**/route.ts", recursive=True) + glob.glob("**/webhooks/**/route.ts", recursive=True)
for sf in stripe_files:
    print(f"Stripe file: {sf}")
    with open(sf) as f:
        lines = f.readlines()
        for i, line in enumerate(lines[:60]):
            print(f"  {i+1}: {line.rstrip()}")

# 4. Agent Identity & Outbound Schema
print("\n--- 4. AGENT IDENTITY & OUTBOUND SCHEMA ---")
outbound_files = glob.glob("**/*outbound*.sql", recursive=True) + glob.glob("**/schema*.ts", recursive=True) + glob.glob("**/agent*.py", recursive=True)
for of in outbound_files:
    if "node_modules" in of or ".next" in of: continue
    print(f"File: {of}")
    with open(of) as f:
        lines = f.readlines()
        for i, line in enumerate(lines[:30]):
            print(f"  {i+1}: {line.rstrip()}")

