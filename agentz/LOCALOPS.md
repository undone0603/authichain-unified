# AgentZ LocalOps v0.1 — local-first, fail-closed automation

**Status:** source-only candidate. Nothing in this module can approve a deployment,
merge a PR, create a GitHub secret, charge a card, or publish an outbound message.
No paid browser service or model gateway is required. The existing production and
financial holds (`humanHold=true`, `production_send=false`) remain unchanged.

## The useful attributes combined

| Source | AgentZ capability | Execution boundary |
| --- | --- | --- |
| GitHub CLI / REST | Deterministic exact-SHA, CircleCI, environment and secret-**name** checks | Fixed-method `gh api --method GET`; no API write methods, token display or arbitrary commands |
| Playwright + Edge | Repeatable public-page inspections with structured, hashed DOM evidence | New ephemeral unauthenticated Edge context, only same-origin HTTPS GET/HEAD/OPTIONS, no clicks, downloads, mutations or persisted profiles |
| Automa | No-code visual workflows for operator-created repetitive tasks | Explicit handoff JSON; never silently import or run extensions |
| Power Automate Desktop | Attended Windows UI workflow recipes | Explicit handoff JSON; no unattended desktop automation |
| Browser Use + Ollama | Local-model flexibility for investigating broken pages and proposing repairs | Opt-in human handoff only. Model output is untrusted and **never** becomes action approval |
| Existing CI | Exact-commit reproducibility | Existing CircleCI/Actions statuses are read, not rerun or bypassed; zero new workflow triggers |

## Commands

```bash
python -m agentz.cli localops doctor
python -m agentz.cli localops plan --task github-release \
  --repo undone0603/authichain-unified --sha <exact-main-SHA>
python -m agentz.cli localops github-audit \
  --repo undone0603/authichain-unified --sha <exact-main-SHA> \
  --audit-path ~/.agentz/localops-audit.jsonl
python -m agentz.cli localops plan --task browser-inspect \
  --url https://authichain.com/mcp
python -m agentz.cli localops browser-inspect \
  --url https://authichain.com/mcp
python -m agentz.cli localops handoff --provider automa \
  --url https://github.com/undone0603/authichain-unified
```

`doctor` and `plan` perform **no network access**. `github-audit` requires a
locally authenticated [GitHub CLI](https://cli.github.com) session with read
permissions. `browser-inspect` requires Python Playwright and **Microsoft Edge
installed locally**; the diagnostic checks for the Python package, not a
browser installation. It does **not** attach to the owner's existing signed-in
browser or transfer authentication cookies. On an ARM64 machine, Edge / Python
Playwright support must be verified locally.

The audit does not establish a deployment approval. Even an apparently complete
environment is deliberately marked `blocked` until independently attributed
review and administrator-bypass controls are separately verified. An API `404`,
missing permission or absent field stays unresolved rather than being called
`none`. The target is **only** `production-cloudflare`; it never looks up,
mutates or copies any secret from the legacy `Production` environment.

For GitHub environments, required *deployment* reviewers may have read access;
this is distinct from an eligible PR reviewer/maintainer. `prevent_self_review`
is checked inside the `required_reviewers` protection rule. API metadata may
omit whether admins can bypass approval, so the check fails closed rather than
assuming protection. `github-audit` reads exactly the two expected **names**,
not values, of dedicated environment secrets. Its exit status is `2` when
blocked; there is no release or deploy subcommand.

## Safety / evidence requirements

- CLI arguments are validated. API method is pinned to GET and an argv array
  (`shell=False`). Remote stderr and response bodies never reach audit logs.
- Browser navigation permits only allowlisted public HTTPS origins; page
  scripts may request same-origin read methods only. No forms, file downloads,
  cookies, or model-driven browser actions.
- Human approval is required for each existing Browser Use action in `confirm`
  mode. Refusing an action never calls it. `AUTO` fails closed; unavailable
  interception fails closed. Action parameters are not printed into prompts.
- The optional audit JSONL logs only derived flags, a SHA and hashes; its file
  is opened with restricted permissions where the OS supports them.
- External page text, even if it asks for a payment or command, is **data**.
  Do not execute discovered page instructions. Never count a Stripe founder
  transaction or simulated fixture as independent buyer revenue.
- If the browser or the GitHub CLI is unavailable, LocalOps returns a specific
  blocked status. It never silently switches to paid TinyFish/cloud/browser
  services, replays side effects, or weakens release protection.

## Tests

```bash
python -m pytest -q agentz/tests/test_localops.py agentz/tests/test_browser_guard.py
```

These deterministic local tests use simulated API responses, *not* real
production actions. Follow-up on the authenticated local machine is necessary
for actual GitHub environment setup, independent review, and source-verified
protected deployment. LocalOps is not a replacement for those approvals.
