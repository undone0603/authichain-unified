import subprocess, json, glob, os, re

def sh(cmd, cwd=None):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    return (res.stdout + "\n" + res.stderr).strip()

print("================ TASK 1 ================")
prs = [1856, 1857, 1858, 1859, 1860, 1861]
for pr in prs:
    raw = sh(f"gh pr view {pr} --json number,title,state,mergeStateStatus,reviewDecision,autoMergeRequest,url")
    print(f"PR #{pr}: {raw}")

print("\n--- PR 1860 ---")
print("Approve 1860:", sh("gh pr review 1860 --approve"))
print("Merge 1860:", sh("gh pr merge 1860 --auto --squash || gh pr merge 1860 --squash"))

print("\n--- Auto-merge 1858, 1859, 1861 ---")
for pr in [1858, 1859, 1861]:
    print(f"PR {pr} merge:", sh(f"gh pr merge {pr} --auto --squash || gh pr merge {pr} --squash"))

print("\n================ TASK 2 ================")
# Find govchain route files
govchain_dir = "workers/govchain-us"
found_file = None
for root, dirs, files in os.walk(govchain_dir):
    for f in files:
        p = os.path.join(root, f)
        try:
            content = open(p).read()
            if "noindex" in content or "sbir-svip" in content or "sbir" in p.lower():
                print(f"Found file in govchain: {p}")
                found_file = p
                print("--- Content ---")
                print(content)
        except Exception as e:
            pass

print("\n================ TASK 3 ================")
pr1856_files = sh("gh pr view 1856 --json files")
print("PR 1856 files:", pr1856_files)

# Look for migrations in the repo
migrations = sh("find . -path '*/migrations/*.sql' -o -name '*migration*'")
print("Migrations found:", migrations)

