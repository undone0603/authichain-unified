import os

print("=== ALL REPO FILES ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next"]):
        continue
    for f in files:
        print(os.path.join(root, f))