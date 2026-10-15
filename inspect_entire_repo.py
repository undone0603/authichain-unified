import os

print("=== DEEP SEARCH FOR ALL FILES ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((",ts", ".js", ".tsx", ".jsx", ".py", ".sql", ".md", ".json")):
            try:
                content = open(p, errors="ignore").read()
                kws = ["user_grants", "stripe", "checkout", "starter", "launch", "rate", "limit", "quota", "middleware"]
                found = [k for k in kws if k in content.lower()]
                if found:
                    print(f"{p}: {found}")
            except:
                pass