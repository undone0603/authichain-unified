import re

file_path = "workers/authichain-com/src/battery-passport-page.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pos = content.find("renderBatteryPassportPage")
print("Position:", pos)
if pos != -1:
    print(content[pos:pos+300])
