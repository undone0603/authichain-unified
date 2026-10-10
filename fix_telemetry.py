with open('agentz/controllers/agentz_controller.py', 'r') as f:
    code = f.read()

code = code.replace('"circuit_breaker_state": self.circuit_breaker.state,', '"circuit_breaker_state": "QUARANTINED" if self.circuit_breaker.is_quarantined else "HEALTHY",')

with open('agentz/controllers/agentz_controller.py', 'w') as f:
    f.write(code)

print("Updated telemetry circuit_breaker_state in agentz_controller.py!")
