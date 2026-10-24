import os
import importlib.util
import sys
from pathlib import Path
from agentz.core.modes import ExecutionContext, Mode

def run_all_workflows():
    import argparse
    parser = argparse.ArgumentParser(description="Run AgentZ workflows")
    parser.add_argument("--mode", default="dry-run", help="Execution mode (dry-run, confirm, auto)")
    args = parser.parse_args()
    mode_str = args.mode

    from agentz.core.auto_policy import consult_agentz_policy

    decision = consult_agentz_policy(mode_str)
    if not decision.get("allowed"):
        print(decision.get("reason") or "AgentZ mode refused", file=sys.stderr)
        sys.exit(2)
    # Adjusted to root directory relative path
    handlers_dir = Path("agentz/workflows/handlers")
    log_file = Path("workflow_execution_summary.log")
    
    with open(log_file, "w") as f:
        f.write("Workflow Execution Summary\n")
        f.write("==========================\n")
        
        for handler_file in sorted(handlers_dir.glob("*.py")):
            if handler_file.name in ["__init__.py", "composite.py"]:
                continue
            
            workflow_id = handler_file.stem
            f.write(f"Launching workflow: {workflow_id}... ")
            f.flush()
            
            try:
                # Dynamic import
                spec = importlib.util.spec_from_file_location(workflow_id, handler_file)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                if hasattr(module, "run"):
                    exec_mode = Mode.DRY_RUN if mode_str == "dry-run" else (Mode.CONFIRM if mode_str == "confirm" else Mode.AUTO)
                    ctx = ExecutionContext(mode=exec_mode, workflow_id=workflow_id)
                    # We assume it runs successfully if it doesn't raise
                    result = module.run(ctx)
                    f.write(f"SUCCESS: {result}\n")
                else:
                    f.write("SKIPPED: No run() function\n")
            
            except Exception as e:
                f.write(f"FAILED: {e}\n")
                print(f"Workflow {workflow_id} failed: {e}")
                # Stop if any critical workflow fails
                sys.exit(1)

if __name__ == "__main__":
    run_all_workflows()
