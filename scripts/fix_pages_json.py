import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
lines = s.splitlines()
out_lines = []
depth = 0
seen_slug_in_obj = False
prev_line = None
for i, line in enumerate(lines):
    stripped = line.lstrip()
    # update depth based on braces in this line, but evaluate before writing for correct context
    # simple counting
    # Before updating depth for this line, check for split condition when inside top-level object
    if depth == 1 and '"slug"' in line and seen_slug_in_obj:
        # close previous object
        out_lines.append('  },')
        # reset seen flag for new object; do not add previous line again
        seen_slug_in_obj = False
    # comma-fix: if prev_line exists and looks like it needs a trailing comma
    if prev_line is not None:
        # if prev_line ends with '"' (a value) and doesn't end with ',' and current stripped starts with '"' (a property)
        if prev_line.rstrip().endswith('"') and not prev_line.rstrip().endswith(',') and stripped.startswith('"'):
            # append comma to prev_line
            out_lines[-1] = out_lines[-1] + ','
    # write current line
    out_lines.append(line)
    # update seen_slug_in_obj if we see slug at depth 1
    if depth == 1 and '"slug"' in line:
        seen_slug_in_obj = True
    # update depth by counting braces in line (naive)
    # count { increments, } decrements
    # but avoid braces inside strings - naive approach may miscount but hope acceptable
    depth += line.count('{') - line.count('}')
    prev_line = line
# join and attempt parse
fixed = '\n'.join(out_lines)
# try parse
import json
try:
    json.loads(fixed)
except Exception as e:
    print('PARSE_ERROR', e)
    # write to .attempt for inspection
    Path(sys.argv[1] + '.attempt').write_text(fixed)
    sys.exit(2)
# write fixed file
Path(sys.argv[1] + '.fixed').write_text(fixed)
print('OK')
