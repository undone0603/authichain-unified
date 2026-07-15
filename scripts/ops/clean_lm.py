import os
import re

def clean_file(path):
    print(f"Cleaning {path}")
    with open(path, "r") as f:
        content = f.read()

    # 1. Remove load_model calls
    content = re.sub(r'^\s*lm_manager\.load_model\(.*\)\n?', '', content, flags=re.MULTILINE)
    
    # 2. Remove finally block with unload_model
    content = re.sub(r'\s*finally:\n\s*lm_manager\.unload_model\(.*\)', '', content)
    
    # 3. Clean up imports
    content = re.sub(r'from agentz\.core\.llm import lm_manager\n', '', content)
    
    with open(path, "w") as f:
        f.write(content)

for filename in os.listdir("agentz/workflows/handlers/"):
    if filename.endswith(".py"):
        clean_file(os.path.join("agentz/workflows/handlers/", filename))
