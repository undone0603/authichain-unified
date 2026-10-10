with open('agentz/core/state_store.py', 'r') as f:
    content = f.read()

content = content.replace("os.makedirs(os.path.dirname(self.store_path), exist_ok=True)", "dirname = os.path.dirname(self.store_path)\n        if dirname:\n            os.makedirs(dirname, exist_ok=True)")

with open('agentz/core/state_store.py', 'w') as f:
    f.write(content)

print("Updated agentz/core/state_store.py!")
