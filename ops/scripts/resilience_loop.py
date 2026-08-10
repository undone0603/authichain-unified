import subprocess
import time
import sys

# The command to execute
cmd = ["./venv/bin/python3", "-m", "agentz.cli", "run", "hot_lead_outreach_blitz", "--mode", "auto"]
max_retries = 5

for i in range(max_retries):
    print(f"Attempt {i+1} of {max_retries}...")
    # Execute the CLI command
    result = subprocess.run(cmd, cwd="/home/zac/agentz")
    
    # Check if the execution was successful
    if result.returncode == 0:
        print("Successfully completed!")
        sys.exit(0)
    
    print(f"Attempt {i+1} failed. Retrying in 5s...")
    time.sleep(5)

print("Max retries reached. Blitz execution failed.")
sys.exit(1)
