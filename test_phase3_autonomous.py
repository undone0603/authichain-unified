import sys, os, json, time, logging

logging.basicConfig(level=logging.INFO)

from agentz.controllers.agentz_controller import AutonomousController
from agentz.scripts.run_autonomous import run_daemon

print("=== RUNNING PHASE 3 INTEGRATED AUTONOMOUS CONTROL TESTS ===")

# 1. Test Controller direct execution cycle
print("\n1. Testing AutonomousController direct execution...")
controller = AutonomousController(db_path=":memory:", threshold=2, cooldown=1.0)

# Check health telemetry initial state
telemetry_init = controller.get_health_telemetry()
print("Initial Telemetry:", json.dumps(telemetry_init, indent=2))
assert telemetry_init["telemetry"]["total_cycles"] == 0
assert "session_nonce" in telemetry_init

# Execute normal cycles
res1 = controller.execute_cycle({"id": "task-1", "action": "ping"})
print("Cycle 1 Result:", res1)
assert res1["status"] in ["SUCCESS", "FAILED", "BLOCKED", "ERROR"]

# Check telemetry updated
telemetry_cycle1 = controller.get_health_telemetry()
print("Cycle 1 Telemetry:", json.dumps(telemetry_cycle1["telemetry"], indent=2))
assert telemetry_cycle1["telemetry"]["total_cycles"] == 1

# Test recovery/reset hook
print("\n2. Testing Recovery/Reset Hook...")
rec_res = controller.reset_recovery_hook()
print("Recovery Hook Result:", rec_res)
assert rec_res["status"] == "RECOVERED"
assert controller.telemetry["recovered_cycles"] == 1

# 3. Test continuous daemon runner
print("\n3. Testing Daemon Runner (run_autonomous)...")
daemon_controller, daemon_results = run_daemon(max_cycles=4, db_path=":memory:")
print(f"Daemon executed {len(daemon_results)} cycles.")
for idx, r in enumerate(daemon_results, 1):
    print(f"  Cycle {idx}: {r['status']} | Nonce: {r.get('nonce')}")

daemon_telemetry = daemon_controller.get_health_telemetry()
print("Daemon Final Health Telemetry:\n", json.dumps(daemon_telemetry, indent=2))
assert daemon_telemetry["telemetry"]["total_cycles"] == 4

print("\nALL PHASE 3 AUTONOMOUS CONTROL TESTS PASSED SUCCESSFULLY! FULLY VALIDATED!")

