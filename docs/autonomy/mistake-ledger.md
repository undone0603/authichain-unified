# Autonomous Engineering Mistake Ledger

This ledger converts material engineering mistakes into permanent controls.

## 2026-10-08 — PR identity mismatch

**Failure:** PR #1481 was assumed to be the Agent Trust delivery PR but was actually an unrelated npm version-bump PR.

**Root cause:** PR number was treated as identity instead of validating title, head branch, SHA, base branch and changed paths.

**Permanent control:** Delivery automation must verify semantic PR identity from live GitHub metadata.

**Regression:** Reject a delivery vehicle when required subsystem paths are absent from the PR diff.

---

## 2026-10-08 — Local/remote implementation drift

**Failure:** The reported local Agent Trust implementation did not match the remote feature branch.

**Root cause:** Local PASS was treated as remote synchronization evidence.

**Permanent control:** Compare local HEAD, remote HEAD, merge-base, required files and PR diff before reporting a remote milestone.

**Regression:** Required-file manifest must be checked after commit, after push, and in the PR.

---

## 2026-10-08 — SQLite versus D1 evidence inflation

**Failure:** SQLite concurrency evidence risked being described as actual Cloudflare D1 runtime validation.

**Root cause:** Evidence layer was not represented explicitly.

**Permanent control:** Label runtime evidence by exact environment: SQLite, Miniflare D1, Wrangler D1, deployed D1.

**Regression:** Runtime claims must name the tested implementation layer.

---

## 2026-10-08 — CI race / duplicated heavyweight runs

**Failure:** Multiple long-running quality jobs were active simultaneously for the same source branch.

**Root cause:** Critical workflows lacked consistent branch-scoped concurrency cancellation and job timeouts.

**Permanent control:** Critical workflows use branch/ref-scoped `concurrency` with `cancel-in-progress: true` and bounded `timeout-minutes`.

**Regression:** Workflow lint checks should reject critical jobs lacking both controls.

---

## 2026-10-08 — Node strip-only TypeScript incompatibility

**Failure:** The Node-native D1 regression runner could not load a TypeScript parameter property.

**Root cause:** Node's strip-only TypeScript mode does not transform parameter-property syntax.

**Permanent control:** Node-native regression tests must import TypeScript that is compatible with strip-only mode, or execute through an explicit TypeScript runtime.

**Regression:** Keep Node-native tests in CI and avoid unsupported TS syntax in imported modules.

---

## 2026-10-08 — Reconstructed test-fixture defects

**Failure:** Reconstructed Agent Trust tests contained an invalid surrogate assertion, an underspecified digest fixture, and an incorrectly re-signed replay fixture.

**Root cause:** Tests were reconstructed without first proving that fixtures exercised the production shape.

**Permanent control:** Security fixtures must be generated from complete canonical objects and must exercise the same signing/verification path.

**Regression:** Keep negative security tests and valid-message construction helpers together.

---

## Adaptation principle

A mistake is complete only when:

```
mistake
→ root cause
→ code/control change
→ regression test
→ automated detection
```

The ledger itself is evidence of learning, not a substitute for the automated control.
