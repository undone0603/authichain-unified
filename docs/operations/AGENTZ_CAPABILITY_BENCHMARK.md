# AgentZ capability benchmark — paired receipt protocol (experimental)

This is a reproducible, offline measurement layer for SI_ADAPTATION_KERNEL.md. It does NOT run AgentZ, use a model, verify signatures, move money, or authorize deployment.

## Run locally

    python -m unittest discover -s agentz/evals -p 'test_benchmark_receipts.py'
    python agentz/evals/benchmark_receipts.py /path/to/redacted-receipts.jsonl

Each JSONL record must specify category, task_id, seed, variant (baseline or candidate), source_sha (40 lowercase hex), evidence_sha256 (64 lowercase hex), passed (Boolean), latency_ms, cost_usd, and security_violations.

Example synthetic fixture (not real performance or verified evidence):

    {"category":"planning","task_id":"task-01","seed":"seed-01","variant":"baseline","source_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","evidence_sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","passed":false,"latency_ms":1200,"cost_usd":0.01,"security_violations":0}

Supply matched baseline and candidate records for every task/seed. Keep fixed task-specific passing rubrics, and pin one source SHA per variant. All five task classes must be represented: planning, coding, recovery, tool_use, long_horizon.

The scorer rejects missing pairs, duplicate trials, malformed digest strings, mixed SHAs, invalid measurements and certain regressions. It reports paired pass gains/losses, pass rates, per-success cost, mean latency, security flags and a conservative review eligibility decision.

IMPORTANT: The digests are merely references in the input. Scoring does not verify signatures, receipt origin, artifact identity, integrity or independence. Even an eligible result remains provisional. Do not treat a JSON field or hash string as cryptographic proof.

## Acceptance before claiming improvement

1. Independently retrieve original redacted trial logs and attestations and recompute SHA-256. Verify signatures and the actual deployment source/artifact identities separately.
2. Fix the task/seed set and passing criteria before comparing variants; audit omissions and repeat with negative/adversarial trials.
3. Inspect failures, costs, recovery, policy violations, security holds and rollback behavior.
4. Allow an authenticated AgentZ host to author a subsequent feat/agentz-* draft PR. Require exact-head protected CI, reviewer approvals and actual current-main checks before merge. This current benchmark PR is assistant-prepared, not proof of an AgentZ-authored PR.
5. Keep production releases separately authorized. No published intelligence claim based solely on local unit tests.

## Revenue priority

Do not divert effort from the existing $299 EU DPP Workspace (50 generations), explicitly NOT a formal audit, certification, or legal opinion. Real revenue requires independent non-founder settled payment, a verified canonical webhook, durable paid-only entitlement and activated buyer access; zero-dollar sessions and paid internal smoke tests do not qualify.

Redact sensitive customer information from evidence and do not commit secrets, keys, private prompts or payment details.
