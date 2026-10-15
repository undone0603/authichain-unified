import os

print("=== SEARCHING SRC, API, AGENTZ, SUPABASE, ETC ===")
keywords = ["user_grants", "stripe", "checkout", "rate_limit", "ratelimit", "middleware", "starter", "launch"]

for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__", "docs"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if p.endswith((".ts", ".js", ".tsx", ".jsx", ".py", ".sql", ".md", ".json")):
            try:
                content = open(p, errors="ignore").read()
                matched = [k for k in keywords if k in content.lower()]
                matched: print(d‰íÁôèíµ…Ñ¡•‘ôˆ¤(€€€€€€€€€€€•á•ÁĞè(€€€€€€€€€€€€€€€Á…ÍÌ