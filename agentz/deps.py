import yaml
import os
from collections import deque

def resolve_dependencies(registry_path=None):
    if registry_path is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        registry_path = os.path.join(base_dir, 'workflows', 'registry.yaml')
    
    if not os.path.exists(registry_path):
        raise FileNotFoundError(f"Registry not found at {registry_path}")

    with open(registry_path, 'r') as f:
        registry = yaml.safe_load(f)
    
    if not registry:
        return []

    graph = {}
    in_degree = {}
    workflow_ids = set(w['id'] for w in registry)
    
    for wf_id in workflow_ids:
        graph[wf_id] = []
        in_degree[wf_id] = 0

    for workflow in registry:
        wf_id = workflow['id']
        prereqs = workflow.get('prerequisites', [])
        for prereq in prereqs:
            if prereq in workflow_ids:
                graph[prereq].append(wf_id)
                in_degree[wf_id] += 1
    
    queue = deque([node for node in workflow_ids if in_degree[node] == 0])
    order = []
    
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in graph[u]:
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)
                
    if len(order) != len(workflow_ids):
        raise ValueError("Circular dependency detected in workflow registry")
        
    return order

if __name__ == "__main__":
    try:
        order = resolve_dependencies()
        print("Validated Execution Order:")
        for i, wf_id in enumerate(order, 1):
            print(f"{i}. {wf_id}")
    except Exception as e:
        print(f"Error: {e}")
