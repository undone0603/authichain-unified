import os, glob, shutil

print("Starting setup script...")
os.system("cp src/components/MissionMilestoneTracker.tsx client/src/components/ 2>/dev/null || true")

apps = glob.glob("**/App.tsx", recursive=True)
print("Found App.tsx files:", apps)
trackers = glob.glob("**/MissionMilestoneTracker.tsx", recursive=True)
print("Found MissionMilestoneTracker.tsx files:", trackers)

for app_path in apps:
    with open(app_path, 'r') as f:
        content = f.read()
    
    if "MissionMilestoneTracker" not in content:
        import_stmt = "import MissionMilestoneTracker from './components/MissionMilestoneTracker';\n"
        lines = content.splitlines(True)
        insert_idx = 0
        for idx, line in enumerate(lines):
            if line.startswith("import "):
                insert_idx = idx + 1
        lines.insert(insert_idx, import_stmt)
        
        new_content = "".join(lines)
        if "<MissionMilestoneTracker />" not in new_content:
            if "return (" in new_content:
                pos = new_content.find("return (")
                tag_pos = new_content.find("<", pos + 8)
                end_tag = new_content.find(">", tag_pos)
                if end_tag != -1:
                    new_content = new_content[:end_tag+1] + "\n      <MissionMilestoneTracker />" + new_content[end_tag+1:]
            elif "return" in new_content:
                pos = new_content.find("return")
                tag_pos = new_content.find("<", pos)
                end_tag = new_content.find(">", tag_pos)
                if end_tag != -1:
                    new_content = new_content[:end_tag+1] + "\n      <MissionMilestoneTracker />" + new_content[end_tag+1:]

        with open(app_path, 'w') as f:
            f.write(new_content)
        print("Updated:", app_path)

