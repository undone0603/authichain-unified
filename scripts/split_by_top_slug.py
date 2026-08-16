import re, sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
# find indices of top-level object starts: lines that start with two spaces, '{', newline, then 4 spaces then "slug"
pattern = re.compile(r'(?m)^  \{\n {4}"slug":')
matches = list(pattern.finditer(s))
if not matches:
    print('NO_MATCH')
    sys.exit(1)
starts = [m.start() for m in matches]
# also include the very first start if file begins differently
# find array start
arr_start = s.find('[')
arr_end = s.rfind(']')
if arr_start == -1 or arr_end == -1:
    print('NO_ARRAY')
    sys.exit(1)
# build object chunks
chunks = []
for i, st in enumerate(starts):
    start = st
    end = starts[i+1] if i+1 < len(starts) else arr_end
    chunk = s[start:end]
    # ensure chunk is a single object: might start with '  {' so keep as-is
    chunks.append(chunk.strip())
# join with comma separators
body = ',\n'.join(chunks)
fixed = s[:arr_start+1] + '\n' + body + '\n' + s[arr_end:]
# try parse
import json
try:
    json.loads(fixed)
except Exception as e:
    Path(sys.argv[1]+'.split_by_slug_attempt').write_text(fixed)
    print('PARSE_ERROR', e)
    sys.exit(2)
Path(sys.argv[1]+'.split_by_slug_fixed').write_text(fixed)
print('OK')
