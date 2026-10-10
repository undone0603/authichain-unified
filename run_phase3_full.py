import os, sys, glob, json, subprocess, time

print("========== PHASE 3 AUTONOMOUS CONTROL INTEGRATION ==========")

# Task 1: Check for Phase 3 plans, roadmap docs, or backlog items
print("\n--- 1. Searching for Phase 3 plans & backlog items ---")
doc_files = []
for root, dirs, files in os.walk('.'):
    if any(k in root for k in ['node_modules', '.git', '.next', '__pycache__', '.venv', 'venv']):
        continue
    for f in files:
        p = os.path.join(root, f)
        if any(term in p.lower() for term in ['phase3', 'phase_3', 'backlog', 'roadmap', 'autonomous_plan']):
            doc_files.append(p)

print(f"Found {len(doc_files)} docs/backlog files: {doc_files}")
for d in doc_files:
    print(f"\n--- Document: {d} ---")
    try:
        with open(d, 'r', encoding='utf-8') as f:
            print(f.read()[:1000])
    except Exception as e:
        print(f"Error reading {d}: {e}")

# Task 2 & 3: Check and wire WorkerBridge, StateStore, CircuitBreaker into AutonomousController and run_autonomous.py
print("\n--- 2 & 3. Examining & Wiring Modules into AutonomousController and run_autonomous.py ---")

ac_file = "agentz/controllers/agentz_controller.py"
ra_file = "agentz/scripts/run_autonomous.py"

with open(ac_file, "r") as f:
    ac_content = f.read()

with open(ra_file, "r") as f:
    ra_content = f.read()

print(f"AutonomousController length: {len(ac_content)}")
print(f"run_autonomous.py length: {len(ra_content)}")

