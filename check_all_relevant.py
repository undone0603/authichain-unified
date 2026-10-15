import os

print("=== CHECKING ALL TS, JS, PY FILES ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__", "docs", "protocol"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((",ts", ".js", ".py", ".sql")):
            print(p)