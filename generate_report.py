import os, glob

report = []
def log(s):
    report.append(str(s))

log("=== 1. REPOSITORY BASELINE & WORKING TREE ===")
# Git status & branch
import subprocess
branch = subprocess.check_output(["git", "branch", "--show-current"]).decode().strip()
status = subprocess.check_output(["git", "status", "--short"]).decode().strip()
log(f"Current Branch: {branch}")
log(f"Working Tree Status: {status if status else 'Clean (stashed changes cleared pending state)'}")

log("\n=== 2. CLOUDFLARE D1 AUTHORIZATION FAILURE (ERROR 7403) ===")
# Check workflows that run wrangler d1 or need D1 access
workflows_d1 = []
for w in glob.glob(".github/workflows/*.yml") + glob.glob(".github/workflows/*.yaml"):
    with open(w) as f:
        content = f.read()
        if "d1" in content.lower() or "wrangler" in content.lower():
            workflows_d1.append((w, content))

log(f"Found {len(workflows_d1)} workflows interacting with D1 / Wrangler:")
for wpath, content in workflows_d1:
    log(f"\nWorkflow: {wpath}")
    for line in content.splitlines():
        if any(k in line for k in ["d1", "wrangler", "CLOUDFLARE", "7403", "database"]):
            log(f"  {line.strip()}")

# Check wrangler.toml files for D1 database configurations
log("\nWrangler D1 Database Configurations:")
for w in glob.glob("**/wrangler.toml", recursive=True):
    with open(w) as f:
        content = f.read()
        if "d1_databases" in content:
            log(f"\nConfig file: {w}")
            for line in content.splitlines():
                if any(k in line for k in ["d1_databases", "binding", "database_name", "database_id"]):
                    log(f"  {line.strip()}")

log("\n=== 3. STRIPE WEBHOOK IMPLEMENTATION ===")
stripe_routes = glob.glob("**/stripe/**/route.ts", recursive=True) + glob.glob("**/webhooks/**/route.ts", recursive=True)
for sr in stripe_routes:
    log(f"\nFile: {sr}")
    with open(sr) as f:
        code = f.read()
        log(code[:1500])

log("\n=== 4. AGENT IDENTITY & OUTBOUND SCHEMA ===")
for p in glob.glob("**/agent-outbound.sql", recursive=True) + glob.glob("**/schema/agent-outbound.sql", recursive=True) + glob.glob("**/agentz/**/*.ts", recursive=True) + glob.glob("**/agent*/**/*.sql", recursive=True):
    if "node_modules" in p or ".next" in p: continue
    log(f"\nFile: {p}")
    with open(p) as f:
        log(f.read()[:1500])

with open("report.txt", "w") as f:
    f.write("\n".join(report))

print("Report generated successfully in report.txt")
