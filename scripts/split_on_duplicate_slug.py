import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
chars = list(s)
out = []
in_str = False
esc = False
depth = 0
i = 0
n = len(chars)
slug_seen_stack = []  # track per object at depth 2
while i < n:
    c = chars[i]
    # handle string start
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
    # not in string
    if c == '"':
        # read full string
        j = i+1
        s_buf = []
        esc2 = False
        while j < n:
            ch = chars[j]
            s_buf.append(ch)
            if esc2:
                esc2 = False
            elif ch == '\\':
                esc2 = True
            elif ch == '"':
                break
            j += 1
        if j >= n:
            out.append(c)
            i += 1
            continue
        string_content = ''.join(s_buf[:-1])
        # lookahead for colon (skip whitespace)
        k = j+1
        while k < n and chars[k] in ' \t\n\r':
            k += 1
        is_property = (k < n and chars[k] == ':')
        # if at object depth 2 and this is property 'slug' and slug_seen true, then we need to split
        if depth == 2 and is_property and string_content == 'slug' and slug_seen_stack and slug_seen_stack[-1]:
            # insert closing of previous object and comma
            # find indentation: look back to last newline in out
            indent = ''
            for ch in reversed(out):
                if ch == '\n':
                    break
                indent = ch + indent
            # default indent two spaces
            prefix = '\n  '
            insertion = '  },\n'
            out.append(insertion)
            # reset slug flag for new object context
            slug_seen_stack[-1] = False
        # write the string including quotes
        out.append('"')
        out.append(string_content)
        out.append('"')
        i = j+1
        continue
    # manage braces
    out.append(c)
    if c == '{':
        depth += 1
        if depth == 2:
            # entering a top-level object
            slug_seen_stack.append(False)
    elif c == '}':
        if depth == 2:
            # leaving top-level object
            if slug_seen_stack:
                slug_seen_stack.pop()
        depth -= 1
    i += 1
# write out
fixed = ''.join(out)
# try parse
import json
try:
    json.loads(fixed)
except Exception as e:
    Path(sys.argv[1]+'.split_attempt').write_text(fixed)
    print('PARSE_ERROR', e)
    sys.exit(2)
Path(sys.argv[1]+'.split_fixed').write_text(fixed)
print('OK')
