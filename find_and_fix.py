import os
import sys

target_files = [
    'config.test.ts',
    'allocator.test.ts',
    'policy.test.ts',
    'verifier.test.ts'
]

found_paths = {}

for root, dirs, files in os.walk('/workspaces/authichain-unified'):
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
    if '.git' in dirs:
        dirs.remove('.git')
    for f in files:
        if f in target_files:
            rel_path = os.path.relpath(os.path.join(root, f), '/workspaces/authichain-unified')
            found_paths[f] = os.path.join(root, f)
            print(f"FOUND {f} at: {os.path.join(root, f)}")

print("Summary of found paths:")
for k, v in found_paths.items():
    print(k, "->", v)

