import os, glob, re

print("Starting repository updates...")

# 2. Rename / ensure mcp-server.ts
p_t = 'workers/authichain-com/src/mcp-server.t'
p_ts = 'workers/authichain-com/src/mcp-server.ts'
if os.path.exists(p_t):
    os.rename(p_t, p_ts)
    print("Renamed mcp-server.t to mcp-server.ts")
elif not os.path.exists(p_ts):
    open(p_ts, 'w').write('// MCP Server\nexport default { fetch: async (req, env, ctx) => new Response("MCP") };\n')
    print("Created mcp-server.ts")
else:
    print("mcp-server.ts already present")

# 3. Wrangler config
w_path = 'workers/authichain-com/wrangler.toml'
if os.path.exists(w_path):
    w_content = open(w_path).read()
    if 'compatibility_flags' in w_content:
        if 'nodejs_compat' not in w_content:
            w_content = re.sub(r'compatibility_flags\s*=\s*\[(.*?)\]', lambda m: f'compatibility_flags = [{m.group(1).strip() + (", " if m.group(1).strip() else "")}"nodejs_compat"]', w_content)
    else:
        w_content += '\ncompatibility_flags = ["nodejs_compat"]\n'
        
    if '[browser]' not in w_content:
        w_content += '\n[browser]\nbinding = "MYBROWSER"\n'
        
    open(w_path, 'w').write(w_content)
    print("Updated wrangler.toml successfully")

# 4. Main worker entry point
src_dir = 'workers/authichain-com/src'
candidates = ['index.ts', 'server.ts', 'router.ts', 'desk.ts']
entry_file = None
for c in candidates:
    if os.path.exists(os.path.join(src_dir, c)):
        entry_file = os.path.join(src_dir, c)
        break

if not entry_file:
    ts_files = [f for f in sorted(os.listdir(src_dir)) if f.endswith('.ts') and not f.endswith('.test.ts') and f != 'mcp-server.ts']
    if ts_files:
        entry_file = os.path.join(src_dir, ts_files[0])

print("Target entry point:", entry_file)

if entry_file and os.path.exists(entry_file):
    content = open(entry_file).read()
    
    # Add import
    if 'mcp-server' not in content and 'mcpServer' not in content:
        import_line = "import mcpServer from './mcp-server';\n"
        content = import_line + content
        
    # Route logic for /mcp, /sse, /sse/message
    if '/mcp' not in content and '/sse' not in content:
        mcp_handler = """
    const url = new URL(request.url);
    if (url.pathname.startsWith('/mcp') || url.pathname.startsWith('/sse')) {
      return mcpServer.fetch(request, env, ctx);
    }
"""
        if 'fetch(' in content or 'fetch (' in content:
            content = re.sub(r'(fetch\s*\([^)]*\)\s*\{)', r'\1' + mcp_handler, content, count=1)
        else:
            content += "\nexport default { async fetch(request, env, ctx) {" + mcp_handler + " return new Response('OK'); } };\n"

    open(entry_file, 'w').write(content)
    print("Updated entry point successfully")

print("All updates completed and saved!")
