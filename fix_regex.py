import sys
with open('middleware.ts', 'r') as f:
    lines = f.readlines()
lines[4] = "    '/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',\\n"
with open('middleware.ts', 'w') as f:
    f.writelines(lines)
