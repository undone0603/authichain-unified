f1 = 'packages/ab-testing/tests/config.test.ts'
f2 = 'packages/ab-testing/tests/allocator.test.ts'
f3 = 'packages/agent-trust/tests/policy.test.ts'
f4 = 'packages/agent-trust/tests/verifier.test.ts'

for f in [f1, f2, f3, f4]:
    print(f"==================== {f} ====================")
    with open(f) as fp:
        print(fp.read())
