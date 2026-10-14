import os
root = '/workspaces/authichain-unified'
print("=== ALL TOP LEVEL ITEMS ===")
for item in sorted(os.listdir(root)):
    p = os.path.join(root, item)
    t = "DIR" if os.path.isdir(p) else "FILE"
    print(f"  [{t}] {item}")
print("\n=== SEARCHING FOR SKILLS / AGENTS / CONFIG DIRS ===")
for d in ['.gemini', 'agentz', '.claude', '.cursor', 'skills', 'agents', '.agents', '.github', '.vscode', 'app', 'skill', 'agent', 'src']:
    dp = os.path.join(root, d)
    if os.path.exists(dp):
        print(f"\n--- {d} ---")
        for root_dir, dirs, files in os.walk(dp):
            rel = os.path.relpath(root_dir, root)
            for f in sorted(files):
                print(f"  {rel}/{f}")
            for sd in sorted(dirs):
                print(f"  [DIR] {rel}/{sd}")
