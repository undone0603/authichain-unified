import sys
from pathlib import Path
p = Path(sys.argv[1])
lines = p.read_text().splitlines()
out = []
N = len(lines)
for idx, line in enumerate(lines):
    out.append(line)
    # find next non-empty line index
    j = idx+1
    while j < N and lines[j].strip() == '':
        j += 1
    if j >= N:
        continue
    cur = line.rstrip()
    nxt = lines[j].lstrip()
    # if current endswith '"' and next starts with '"' and next contains '":' within first 80 chars -> add comma
    if cur.endswith('"') and nxt.startswith('"') and (('":' in lines[j][:80])):
        if not cur.endswith(','):
            out[-1] = out[-1] + ','
    # if current endswith '}' and next startswith '{' -> add comma
    if cur.endswith('}') and nxt.startswith('{'):
        if not cur.endswith(','):
            out[-1] = out[-1] + ','
# join and try parse
fixed = '\n'.join(out) + '\n'
import json
try:
    json.loads(fixed)
except Exception as e:
    Path(sys.argv[1]+'.lines_attempt').write_text(fixed)
    print('PARSE_ERROR', e)
    sys.exit(2)
Path(sys.argv[1]+'.lines_fixed').write_text(fixed)
print('OK')
