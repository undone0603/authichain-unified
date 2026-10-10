with open('agentz/controllers/agentz_controller.py', 'r') as f:
    code = f.read()

code = code.replace("self.circuit_breaker = CircuitBreaker(failure_threshold=threshold, cooldown=cooldown)", "self.circuit_breaker = CircuitBreaker(threshold=threshold)")

with open('agentz/controllers/agentz_controller.py', 'w') as f:
    f.write(code)

print("Updated agentz/controllers/agentz_controller.py successfully!")
