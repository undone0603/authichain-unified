import os
import glob
import sys

# Ensure stdout handles unicode on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() in ("cp1252", "ascii"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def patch_workerd():
    # Find the workerd main.js file
    # It might be in node_modules or deeper in .pnpm store
    patterns = [
        "node_modules/workerd/lib/main.js",
        "node_modules/.pnpm/workerd*/node_modules/workerd/lib/main.js"
    ]
    
    found_files = []
    for pattern in patterns:
        found_files.extend(glob.glob(pattern, recursive=True))
    
    if not found_files:
        print("❌ Could not find workerd/lib/main.js to patch.")
        return

    old_string = '"win32 x64 LE": "@cloudflare/workerd-windows-64"'
    new_string = '"win32 x64 LE": "@cloudflare/workerd-windows-64",\n  "win32 arm64 LE": "@cloudflare/workerd-windows-64"'

    for file_path in found_files:
        with open(file_path, 'r') as f:
            content = f.read()
        
        if '"win32 arm64 LE"' in content:
            print(f"✅ {file_path} is already patched.")
            continue
            
        if old_string in content:
            new_content = content.replace(old_string, new_string)
            with open(file_path, 'w') as f:
                f.write(new_content)
            print(f"🛠️ Patched {file_path}")
        else:
            print(f"⚠️ Could not find target string in {file_path}")

if __name__ == "__main__":
    patch_workerd()
