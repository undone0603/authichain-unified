import glob
import os
import re

targets = ['config.test.ts', 'allocator.test.ts', 'policy.test.ts', 'verifier.test.ts']
found = {}

for p in glob.glob('**/*.test.ts', recursive=True):
    for t in targets:
        if p.endswith(t) or t in p:
            found[t] = p

print("FOUND TARGETS:", found)

for t, path in found.items():
    print(f"\n==================== {path} ====================")
    with open(path) as f:
        print(f.read())

