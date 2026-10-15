import os
keywords = ["user_grants", "stripe", "checkout", "rate", "middleware", "starter", "launch"]
print("=== RELEVANT FILES ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".venv", ".git", "node_modules", ".next", "__pycache__"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((".ts", ".js", ".tsx", ".jsx", ".py", ".sql", ".md", ".json")):
            try:
                content = open(p, errors="ignore").read()
                matched = [k for k in keywords if k in content.lower()]
                if matched:
                    print(p, "Matches:", matched)
            except Exception as e:
                pass