import os

keys = ["user_grants", "stripe", "checkout", "rate", "middleware", "supabase", "starter", "launch"]
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        try:
            txt = open(p, errors="ignore").read()
            found = [k for k in keys if k in txt.lower()]
            if found:
                print(f"{p} : {found}")
        except:
            pass