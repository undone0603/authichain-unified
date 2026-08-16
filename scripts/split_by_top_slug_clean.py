import re, sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
pattern = re.compile(r'(?m)^  \{\n {4}"slug":')
matches = list(pattern.finditer(s))
arr_start = s.find('[')
arr_end = s.rfind(']')
if arr_start == -1 or arr_end == -1 or not matches:
    print('NO_MATCH_OR_ARRAY')
    sys.exit(1)
starts = [m.start() for m in matches]
chunks = []
for i, st in enumerate(starts):
    start = st
    end = starts[i+1] if i+1 < len(starts) else arr_end
    chunk = s[start:end]
    # clean leading/trailing commas and whitespace
    chunk = chunk.strip()
    # remove trailing comma if present
    if chunk.endswith(','):
        chunk = chunk[:-1].rstrip()
    # ensure starts with '{'
    if chunk.startswith('  {'):
        chunk = chunk[2:]
    elif chunk.startswith('{'):
        pass
    else:
        # try to find first '{'
        idx = chunk.find('{')
        if idx != -1:
            chunk = chunk[idx:]
    chunks.append(chunk)
body = ',\n'.join(chunks)
fixed = s[:arr_start+1] + '\n' + body + '\n' + s[arr_end:]
import json
try:
    json.loads(fixed)
except Exception as e:
    Path(sys.argv[1]+'.split_by_slug_clean_attempt').write_text(fixed)
    print('PARSE_ERROR', e)
    sys.exit(2)
Path(sys.argv[1]+'.split_by_slug_clean_fixed').write_text(fixed)
print('OK')
