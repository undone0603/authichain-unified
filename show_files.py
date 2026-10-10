files = [
    'tests/ab-testing/config.test.ts',
    'tests/ab-testing/allocator.test.ts',
    'tests/agent-trust/policy.test.ts',
    'tests/agent-trust/verifier.test.ts'
]
for f in files:
    print('=== FILE: ' + f + ' ===')
    with open(f) as fp:
        lines = fp.readlines()
        for idx, line in enumerate(lines, 1):
            print(f'{idx:3d}: {line}', end='')
    print()
