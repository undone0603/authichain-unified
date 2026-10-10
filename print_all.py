files = ['tests/ab-testing/config.test.ts', 'tests/ab-testing/allocator.test.ts', 'tests/agent-trust/policy.test.ts', 'tests/agent-trust/verifier.test.ts']
for f in files:
    print('=== ' + f + ' ===')
    with open(f) as fp:
        print(fp.read())
