import re

fp = 'workers/authichain-com/src/battery-passport-page.ts'
with open(fp, 'r', encoding='utf-8') as f:
    c = f.read()

pos = c.find('function renderBatteryPassportPage')
b_start = c.find('{', pos)
depth = 0
b_end = -1
for i in range(b_start, len(c)):
    if c[i] == '{':
        depth += 1
    elif c[i] == '}':
        depth -= 1
        if depth == 0:
            b_end = i
            break

body = c[b_start + 1 : b_end]
wrapped = '\n  try {\n' + body + '\n  } catch (error) {\n    console.error("Error rendering battery passport page:", error);\n    throw error;\n  }\n'
new_c = c[:b_start + 1] + wrapped + c[b_end:]

with open(fp, 'w', encoding='utf-8') as f:
    f.write(new_c)

print("SUCCESS")
