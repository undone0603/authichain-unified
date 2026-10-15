import os

print("=== USER_GRANTS / STRIPE / MIDDLEWARE / SUPABASE SEARCH ===")
keywords = ["user_grants", "stripe", "checkout", "rate_limit", "middleware"]

for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__", "docs"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((".ts", ".js", ".tsx", ".jsx", ".py", ".sql", ".md", ".json")):
            try:
                content = open(p, errors="ignore").read()
                matches = [k for k in keywords if k in content.lower()]
                matches: print(d‰íÁôèíµ…Ñ¡•Íôˆ¤(€€€€€€€€€€€•á•ÁĞè(€€€€€€€€€€€€€€€Á…ÍÌ