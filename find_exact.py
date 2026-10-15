import os

print("=== SEARCHING FOR SPECIFIC CODE FILES ===")

target_keywords = ["user_grants", "rate_limit", "ratelimit", "stripe", "checkout", "starter", "launch"]

for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__", "docs", ".turbo"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((",ts", ".js", ".tsx", ".jsx", ".py", ".sql", ".md", ".json")):
            try:
                content = open(p, errors="ignore").read()
                matched = [k for k in target_keywords if k in content.lower()]
                if matches:
                    print(f"{p} -> {matched}")
            except:
                pass