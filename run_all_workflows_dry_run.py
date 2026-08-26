
import importlib
import sys
import os
from pathlib import Path
from agentz.core.modes import ExecutionContext, Mode

# Ensure the root directory is in sys.path so 'agentz' can be imported
sys.path.append(os.getcwd())

def run_dry_run():
    handlers_dir = Path("agentz/workflows/handlers")
    
    results = {}
    
    for file_path in handlers_dir.glob("*.py"):
        if file_path.name in ["__init__.py", "composite.py"]:
            continue
            
        module_path = f"agentz.workflows.handlers.{file_path.stem}"
        print(f"--- Checking workflow: {module_path} ---")
        
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "run"):
                ctx = ExecutionContext(mode=Mode.DRY_RUN, workflow_id=file_path.stem)
                print(f"  [Executing {file_path.stem}]")
                try:
                    result = module.run(ctx)
                    results[file_path.stem] = {"status": "success", "result": result}
                except Exception as e:
                    results[file_path.stem] = {"status": "failed", "error": str(e)}
            else:
                results[file_path.stem] = {"status": "skipped", "reason": "no run() function"}
        except Exception as e:
            results[file_path.stem] = {"status": "failed", "error": f"Import error: {str(e)}"}
            
    print("\n\n--- Workflow Execution Summary ---")
    for name, status in results.items():
        print(f"{name}: {status['status']}")
        if status.get("error"):
            print(f"  Error: {status['error']}")

if __name__ == "__main__":
    run_dry_run()
