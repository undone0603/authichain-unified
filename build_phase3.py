import sys, os, glob, json, time, traceback

print("=== STEP 1: Search Phase 3 docs & backlog items ===")
docs_found = []
for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', '.next', '__pycache__', '.venv', 'venv']):
        continue
    for f in files:
        p = os.path.join(root, f)
        if any(term in p.lower() for term in ['phase3', 'phase_3', 'backlog', 'roadmap', 'plan']):
            docs_found.append(p)

print("Found backlog/roadmap/plan documents:", docs_found)
for p in docs_found:
    print(f"\n--- Content of {p} ---")
    try:
        with open(p, 'r') as file:
            print(file.read()[:1000])
    except Exception as e:
        print(e)

