import glob, os

targets = [
    'tests/ab-testing/config.test.ts',
    'tests/ab-testing/allocator.test.ts',
    'tests/agent-trust/policy.test.ts',
    'tests/agent-trust/verifier.test.ts'
]

for t in targets:
    matches = [p for p in glob.glob('**/' + t, recursive=True) if 'node_modules' not in p]
    print(f"=== TARGET {t} -> Matches: {matches} ===")
    for m in matches:
        with open(m) as f:
            print(f.read())
