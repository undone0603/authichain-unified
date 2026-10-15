import os

print("=== REPO STRUCTURE ===")
for item in os.listdir("."):
    if not item.startswith(".") and item not in ["node_modules", ".venv"]:
        print(item)

print("\n=== SEARCH FOR MIDDLEWARE AND STRIPE WEBHOOK FILES ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv"]):
        continue
    for f in files:
        p = os.path.join(root, f)
        if "middleware" in f.lower() or "stripe" in f.lower() or "webhook" in f.lower() or "rate" in f.lower() or "grant" in f.lower() or f == "README.md":
            print(p)