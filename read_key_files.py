import os

print("=== CHECKING FILE CONTENTS ===")

for path in ["README.md", "agentz/README.md", "agentz/api/billing_webhook.py", "agentz/core/grants.py", "agentz/core/grants_pipeline.py"]:
    if os.path.exists(path):
        print(f"\n==================== {path} ====================")
        print(open(path).read())