import os

print("=== CODE FILES SEARCH ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".venv", ".git", "node_modules", ".next", "__pycache__", "docs"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((",ts", ".js", ".tsx", ".jsx", ".py", ".sql", ".md", ".json")):
            try:
                content = open(p, errors="ignore").read()
                kws = ["user_grants", "stripe", "checkout", "rate_limit", "ratelimit", "middleware", "supabase", "starter", "launch"]
                matched = [k for k in kws if k in content.lower()]
                if matched:
                    print(f"{p}: {matched}")
            except Exception as e:
                pass