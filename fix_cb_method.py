with open('agentz/controllers/agentz_controller.py', 'r') as f:
    code = f.read()

code = code.replace("can_execute()", "check_execution_allowed()")

with open('agentz/controllers/agentz_controller.py', 'w') as f:
    f.write(code)

print("Updated CircuitBreaker method in agentz_controller.py!")
