import os

print("=== ALL NON-DOCS FILES ===")
for root, dirs, files in os.walk("."):
    if any(x in root for x in [".git", "node_modules", ".next", ".venv", "__pycache__", "docs", "artifacts"]):
        continue
    for f in files:
        print(os.path.join(root, f))