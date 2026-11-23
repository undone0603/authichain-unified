# AgentZ capability assessment — can it win independently?

Date: 2026-11-23
Scope: Can AgentZ, on the owner's behalf, (1) review a contract, (2) agree to terms,
(3) provide an action, (4) execute deliverables, and (5) collect a win — or what is the
most critical path along those lines?
Method: live read-only probes of the running service + AgentZ guardrails.

## Current state (verified 2026-11-23, read-only)

| Check | Result | Meaning |
|---|---|---|
| systemd `authichain-agentz` | **inactive** | The managed unit is not running… |
| `GET /health` | `200 {"status":"sovereign","network":"Polygon"}` | …yet something else serves :8000. Running version/state is unverified. |
| `GET /identity` | **500 error** | Possession unconfirmed; AgentZ cannot reliably assert or sign as itself. |
| `POST /browser/navigate` | **503 "network-isolated browser host required"** | Cannot fetch arbitrary web / contract pages itself. |
| `GET /workflows` | 84 workflows | Service is responsive and has its catalog. |

## Step-by-step verdict

| Step | Verdict | Basis |
|---|---|---|
| **1. Review contract** | ⚠️ Partial | Cannot retrieve live source (browser 503). Can analyze source it is *given* and run analysis workflows. Retrieval = no; analysis = yes. |
| **2. Agree to terms** | ❌ Hard gate | Accepting terms / stating eligibility is owner-only under AgentZ's rules, and legally requires the human (18+, KYC, own accounts). An agent cannot consent on the owner's behalf. |
| **3. Provide action** | ⚠️ Blocked / sandbox | `code-proposal` needs `AGENTZ_GITHUB_CODE_TOKEN` (unset → 503). Even enabled it is limited to `feat/agentz-*` draft PRs under `agentz/`, `tests/`, `docs/`, one file ≤100 KB, never `main`. Workflows run dry-run by default. |
| **4. Execute deliverables** | ✅ Sandbox only | Draft PRs, dry-run workflow outputs, notes/memory — yes. Deploy / merge / send / publish — no (gates). |
| **5. Collect win** | ❌ Hard gate + unable | Requires funds / KYC / submission / identity. Rules: $0 discretionary spend, no self-payments, never hold funds, no outbound submission, no eligibility statements. `/identity` is also erroring. |

## Conclusion

End-to-end **"review → agree → act → deliver → collect" is not achievable — by design, not by tuning.**
- Steps 2 (agree to terms) and 5 (collect win) are permanently the owner's: both by AgentZ's
  guardrails and by the external programs' own eligibility rules.
- Step 3 (provide action) is gated behind a GitHub token that is not set.
- Step 1 (review) is capped by the isolated browser host.
- Only step 4 (sandbox deliverables) is fully live today.

## Most critical path (what actually works)

Use AgentZ as a **sandbox deliverable engine**; the owner holds the three outward gates.

1. **Owner** picks the target and accepts its terms.
2. **AgentZ** does the heavy lifting in-sandbox: analyze the source/goal it is fed, draft code on
   `feat/agentz-*` as draft PRs, run dry-run workflows, assemble the submission/report package.
3. **Owner** submits and collects.

## Enabling fixes, by payoff (each is the owner's call)

1. Set `AGENTZ_GITHUB_CODE_TOKEN` → unlocks `code-proposal` (step 3). Highest leverage.
2. Resolve the inactive-unit-vs-live-process split → reliability before depending on it for anything timed.
3. Fix `/identity` (500) → only needed if AgentZ must sign evidence as itself.

## Guardrails that stay fixed regardless

No outbound messages without the owner approving specific recipients + copy · $0 discretionary
spend, no self-payments to game verification · never bypass branch protection (merge only on green
`main-quality-gate`, `--match-head-commit`) · never expose credentials · never work around a
permission denial · AgentZ must not submit entries or make eligibility statements · report actual
results, never fabricate.
