import sys
from pathlib import Path
s = Path(sys.argv[1]).read_text()
chars = list(s)
out = []
depth = 0
in_str = False
esc = False
i = 0
n = len(chars)
# helper to find previous non-whitespace char in out
def prev_non_ws(out_list):
    for c in reversed(out_list):
        if c not in ' \t\n\r':
            return c
    return None
while i < n:
    c = chars[i]
    out.append(c)
    if in_str:
        if esc:
            esc = False
        elif c == '\\':
            esc = True
        elif c == '"':
            in_str = False
    else:
        if c == '"':
            in_str = True
        elif c == '{' or c == '[':
            depth += 1
        elif c == '}' or c == ']':
            depth -= 1
            # if we just closed an object inside the top-level array (depth==1 now because array is depth 1)
            # and next non-ws char (ahead) is '{', but there's no comma between, insert comma
            if c == '}' and depth == 1:
                # lookahead
                j = i+1
                while j < n and chars[j] in ' \t\n\r':
                    j += 1
                if j < n and chars[j] == '{':
                    # check if previous non-ws in out is ',' already
                    p = prev_non_ws(out)
                    if p != ',':
                        out.append(',')
        # Also: if we encounter a quote starting a property name at object depth>=2 and previous non-ws char is '"' or '}' or ']' or alnum (a value end) and not ',', insert comma
        elif c == '"':
            # starting a string, but we're not in_str yet because we handle entering above; this branch won't run because we set in_str earlier.
            pass
    i += 1
# Second pass to insert missing commas before property names when necessary
s2 = ''.join(out)
chars = list(s2)
out2 = []
in_str = False
esc = False
depth = 0
i = 0
n = len(chars)
while i < n:
    c = chars[i]
    # detect start of a property name: a quote when not in_str and previous non-ws char is '{' or ',' or any
    if not in_str and c == '"':
        # check if this is a property name (lookahead for : later)
        # find colon after the closing quote
        j = i+1
        in_q = False
        esc2 = False
        is_prop = False
        while j < n:
            ch = chars[j]
            if in_q:
                if esc2:
                    esc2 = False
                elif ch == '\\':
                    esc2 = True
                elif ch == '"':
                    in_q = False
                # else continue
            else:
                if ch == '"':
                    in_q = True
                elif ch in ' \t\n\r':
                    pass
                elif ch == ':':
                    is_prop = True
                    break
                else:
                    break
            j += 1
        if is_prop and depth >= 2:
            p = prev_non_ws(out2)
            if p is not None and p not in ['{', ',', ':', '[']:
                # insert comma before this quote
                out2.append(',')
        # now append the quote and continue
        out2.append(c)
        in_str = True
        i += 1
        continue
    out2.append(c)
    if in_str:
        if esc:
            esc = False
        elif c == '\\':
            esc = True
        elif c == '"':
            in_str = False
    else:
        if c == '"':
            in_str = True
        elif c == '{' or c == '[':
            depth += 1
        elif c == '}' or c == ']':
            depth -= 1
    i += 1
fixed = ''.join(out2)
# try parse
import json
try:
    json.loads(fixed)
except Exception as e:
    Path(sys.argv[1] + '.robust_attempt').write_text(fixed)
    print('PARSE_ERROR', e)
    sys.exit(2)
# write fixed
Path(sys.argv[1] + '.fixed').write_text(fixed)
print('OK')
