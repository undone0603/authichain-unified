import os

print("=== ROOT README.md ===")
if os.path.exists("README.md"):
    print(open("README.md").read())

print("\n=== AGENTZ README.md ===")
if os.path.exists("agentz.README.md"):
    print(open("agentz.README.md").read())
