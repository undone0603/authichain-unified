# AgentZ peer-learning loop: evidence, not endorsement

**Status:** source-level feature in draft PR #2266; not a live daemon deployment.

## Objective and scope

Turn genuine, attributable external feedback into **bounded next-step suggestions** for human/security review. AgentZ must not rewrite model weights, promote its own comments to independent endorsement, execute instructions found in web pages, or change payment / product authenticity / authorization state based on a claimed peer review.

`agentz/core/peer_learning.py` accepts up to 20 curated public GitHub or GitLab observations. A subject can be `mcp_interop`, `a2a_tck`, `payment_integrity`, or `agent_identity`. Unknown fields and raw page text are **discarded**, not read as agent instructions. The source checker rejects non-HTTPS URLs, non-GitHub/GitLab hosts, secrets in query strings, credentials in URLs, control characters and custom ports.

The initial public-only snapshot in `agentz/learning/public_peer_observations.json` records:
- A reply by `vSkilled` in the Cedr Guard #7 conversation explaining upstream features in Cedr PRs #18/#19. This is **external feedback**, not AuthiChain validation.
- AuthiChain's own posts to the Cedr and A2A issues, plus its payment-integrity PR. These are **self activity**, not peer validation.

The workflow's result may say `request_specific_test_result` or `reproduce_external_test`. **No automatic request is sent.** A claimed outside test report remains `external_test_claim_unverified` even if its author differs from the repo owner; identity attribution and the test must be independently checked. A positive or negative external fixture should become an actual regression only after source, version and reproducibility have been examined.

## Manual operation on a configured AgentZ host

```sh
# No network or checkpoint write:
python -m agentz.cli run peer_feedback_learning --mode dry-run

# Explicit local review and checkpoint creation:
python -m agentz.cli run peer_feedback_learning --mode confirm
```

Output checkpoint is the existing AgentZ `agentz/logs/checkpoints/peer_feedback_learning.json`, and AgentZ's regular audit path records the workflow result. The snapshot is repository-controlled rather than fetched from arbitrary URLs at execution time; the user/connected account must verify source authorship before updating it. This workflow **is not enabled in the daemon**, and it has **no TinyFish key requirement**, no browser automation, no outreach, and no monetary side effects.

### Learning acceptance criteria

1. Outside feedback is actually attributable to a distinct public project and has a permalink.
2. For a valid independent test, record the external report, verifier implementation and pinned test/target revisions.
3. Run or inspect a reproducible positive and negative fixture; report any failures honestly.
4. Open a reviewable change/issue tied to the finding without auto-merging or auto-posting.
5. Only after independent review may it inform release gating. Never equate an MCP Registry listing, unsigned A2A AgentCard, a $0 demo or the author's own issue comment with certification, real product authenticity, paid transaction or partner endorsement.

**Current next action:** request one actual Cedr `guard remote` JSON result (or reproducible failed/unsupported result) from an independent runner. A [public no-credential fixture](https://gitlab.com/authichain-group/authichain-unified/-/blob/feat/agentz-open-agent-alliance-kit-20261101/fixtures/alliances/cedr-authichain/README.md) was provided in Cedr issue #7. AuthiChain's own submitted fixture is only an invitation; no independent result has been returned.

This workflow does not waive `humanHold`, `production_send=false`, code-owner review, branch protection or independent CI.
