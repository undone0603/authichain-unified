import re, sys, json
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
# find candidate starts: lines starting with two spaces then '{' and next lines contain slug
pattern = re.compile(r'(?m)^  \{\n {4}"slug":')
starts = [m.start() for m in pattern.finditer(s)]
if not starts:
    print('NO_STARTS')
    sys.exit(1)
n = len(s)
collected = []
for idx, st in enumerate(starts):
    # parse object from st until matching '}' at same nesting (object depth 2)
    i = st
    depth = 0
    in_str = False
    esc = False
    obj_chars = []
    while i < n:
        ch = s[i]
        obj_chars.append(ch)
        if in_str:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    # end of object
                    break
        i += 1
    obj_text = ''.join(obj_chars)
    # ensure object text starts with '{'
    # attempt parse
    try:
        o = json.loads(obj_text)
        collected.append(o)
    except Exception:
        # skip bad object
        continue
# write collected array
out_path = Path(sys.argv[1]).with_suffix('.recovered.json')
out_path.write_text(json.dumps(collected, indent=2, ensure_ascii=False))
print('RECOVERED', len(collected), 'objects to', out_path)
