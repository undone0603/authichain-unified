
import subprocess, json, glob, os, re

def sh(cmd, cwd=None):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return (res.stdout + "\n" + res.stderr).strip()

print("=== TASK 1 DETAILS ===")
for pr in [1856, 1857, 1858, 1859, 1860, 1861]:
    res = sh(f"gh pr view {pr} --json number,title,state,mergeStateStatus,reviewDecision,autoMergeRequest,url,headRefName")
    print(f"PR {pr}: {res}")

print("\n=== CHECKING WRANGLER & MIGRATIONS FOR TASK 3 ===")
# Find migration files in repo
sql_files = sh("find . -name *.sql")
print("SQL files:", sql_files)

# Check wrangler d1 migrations or similar for QRON-v2
wrangler_check = sh("npx wrangler d1 migrations list QRON-v2 || wrangler d1 migrations list QRON-v2 || true")
print("Wrangler check:", wrangler_check)

print("\n=== CHECKING GOVCHAIN US SBIR FOR TASK 2 ===")
gov_files = sh("find workers/govchain-us -type f")
print("Govchain files:", gov_files)

