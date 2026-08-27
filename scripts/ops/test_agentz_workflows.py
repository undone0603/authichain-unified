#!/usr/bin/env python3
"""Run AgentZ workflows dry-run verification."""
from agentz.core.runner import load_registry, execute
from agentz.core.modes import Mode

def main():
    registry = load_registry()
    print(f"Loaded {len(registry)} registered workflows.")
    
    target_ids = ["authichain_pilot_deploy", "authichain_compliance_audit", "hot_lead_outreach_blitz"]
    for wf_id in target_ids:
        if wf_id in registry:
            res = execute(registry[wf_id], mode=Mode.DRY_RUN, verbose=True)
            print(f"Workflow {wf_id} -> {res.status}")
        else:
            print(f"Workflow {wf_id} not found in registry")

if __name__ == "__main__":
    main()
