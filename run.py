import subprocess, json, glob, os, re

def sh(cmd, cwd=None):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return (res.stdout + "\n" + res.stderr).strip()

print("=== 1. PR AND CI STATUS ===")
prs = [1856, 1857, 1858, 1859, 1860, 1861]
for pr in prs:
    print(f"PR #{pr}:", sh(f"gh pr view {pr} --json number,title,state,mergeStateStatus,reviewDecision,autoMergeRequest,url"))

print("\n--- Approve & Merge 1860 ---")
print("Approve 1860:", sh("gh pr review 1860 --approve"))
print("Merge 1860:", sh("gh pr merge 1860 --auto --squash || gh pr merge 1860 --squash"))

print("\n--- Merge 1858, 1859, 1861 ---")
for pr in [1858, 1859, 1861]:
    print(f"PR #{pr} merge:", sh(f"gh pr merge {pr} --auto --squash || gh pr merge {pr} --squash"))

print("\n=== 2. GOVCHAIN SBIR ===")
for root, dirs, files in os.walk("workers/govchain-us"):
    for f in files:
        p = os.path.join(root, f)
        try:
            c = open(p).read()
            if "noindex" in c or "sbir" in p.lower():
                print(f"FILE: {p}")
                print(c)
        except Exception:
            pass

print("\n=== 3. PR 1856 MIGRATION ===")
print("pr1856 files: ", sh("gh pr view 1856 --json files"))
