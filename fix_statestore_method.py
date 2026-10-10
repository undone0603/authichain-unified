with open('agentz/controllers/agentz_controller.py', 'r') as f:
    code = f.read()

code = code.replace("record_event", "record_audit")

with open('agentz/controllers/agentz_controller.py', 'w') as f:
    f.write(code)

print("Updated StateStore record_audit in agentz_controller.py!")
