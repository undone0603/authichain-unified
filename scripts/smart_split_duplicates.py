import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
chars = list(s)
out = []
in_str = False
esc = False
depth = 0
key_stack = []  # stack of sets for keys seen in each object
i = 0
n = len(chars)
while i < n:
    c = chars[i]
    if in_str:
        out.append(c)
        if esc:
            esc = False
        elif c == '\\':
            esc = True
        elif c == '"':
            in_str = False
        i += 1
        continue
    if c == '"':
        # read string
        j = i+1
        buf = []
        esc2 = False
        while j < n:
            ch = chars[j]
            buf.append(ch)
            if esc2:
                esc2 = False
            elif ch == '\\':
                esc2 = True
            elif ch == '"':
                break
            j += 1
        if j >= n:
            out.append(c); i += 1; continue
        key = ''.join(buf[:-1])
        # lookahead to see if this is a property name (colon follows)
        k = j+1
        while k < n and chars[k] in ' \t\n\r':
            k += 1
        is_prop = (k < n and chars[k] == ':')
        # if this is a property name and we're inside an object
        if is_prop and key_stack:
            cur_keys = key_stack[-1]
            # keys that suggest a split if duplicated
            split_keys = set(['slug','@type','name','description','url'])
            if key in split_keys and key in cur_keys:
                # insert closing of previous object and comma before this property
                # remove trailing whitespace in out
                # ensure we insert at correct indentation level: find last newline in out
                out.append('  },\n')
                # reset current keys for new object
                key_stack[-1] = set()
        # record key in current object if is_prop
        out.append('"')
        out.append(key)
        out.append('"')
        if is_prop and key_stack:
            key_stack[-1].add(key)
        i = j+1
        continue
    out.append(c)
    if c == '{':
        depth += 1
        # push new key set for this object
        key_stack.append(set())
    elif c == '}':
        # pop key set
        if key_stack:
            key_stack.pop()
        depth -= 1
    i += 1
fixed = ''.join(out)
# try parse
import json
try:
    json.loads(fixed)
except Exception as e:
    Path(sys.argv[1]+'.smart_attempt').write_text(fixed)
    print('PARSE_ERROR', e)
    sys.exit(2)
Path(sys.argv[1]+'.smart_fixed').write_text(fixed)
print('OK')
