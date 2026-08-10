"""
test_system
-----------
The master test script for the AgentZ Autonomous Trust Infrastructure.
Runs the complete test suite and provides a status report.
"""
import subprocess
import sys
import os

def run_tests():
    print("🚀 --- STARTING COMPREHENSIVE SYSTEM VALIDATION --- 🚀")
    
    # 1. Unit & Integration Tests (pytest)
    print("\n[1/3] Running Core Logic & Infrastructure Tests...")
    # Use python -m pytest to avoid path issues
    res = subprocess.run([sys.executable, "-m", "pytest", "tests/test_agents.py", "tests/test_infrastructure.py"], capture_output=True, text=True)
    print(res.stdout)
    if res.returncode != 0:
        print(f"[XX] Core tests failed. Error: {res.stderr}")
    else:
        print("[OK] Core logic and connectivity verified.")

    # 2. API Gateway Tests
    print("\n[2/3] Verifying FastAPI Gateway...")
    res_api = subprocess.run([sys.executable, "-m", "pytest", "tests/test_api.py"], capture_output=True, text=True)
    print(res_api.stdout)
    if res_api.returncode != 0:
        print(f"[XX] API tests failed. Error: {res_api.stderr}")
    else:
        print("[OK] API Gateway verified.")

    # 3. LLM Failover Resilience
    print("\n[3/3] Testing LLM Waterfall Failover...")
    res_llm = subprocess.run([sys.executable, "tests/test_failover.py"], capture_output=True, text=True)
    print(res_llm.stdout)
    if "failed" in res_llm.stderr:
        print(f"[XX] LLM Failover test crashed. Error: {res_llm.stderr}")
    else:
        print("[OK] LLM Resilience logic verified.")

    print("\n🚀 --- SYSTEM VALIDATION COMPLETE --- 🚀")

if __name__ == "__main__":
    run_tests()
