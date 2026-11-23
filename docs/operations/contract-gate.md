# ContractGate (shadow mode)

_Added 2026-11-23. Agent governance only. Changes no DPP or CIRPASS schema or claim._

## What it is

`agentz/core/contract_gate.py` ports the AI Adapt research build of
2026-11-23 (Intent Contracts, arXiv:2611.24025). It is an original
implementation; the upstream plugin is MIT and nothing is copied.

For each write, the planning model states a **contract**:

- a goal of at most 100 words, with no command lines;
- a verbatim quote of the user's words;
- the write prefixes and egress hosts it needs, which may only narrow the configured baseline;
- an error policy, `stop` or `report`.

Trusted code validates the contract. A trusted executor then writes the call.
Dispatch drops any call outside the contract's scope. Every contract is sealed
in a hash-chained log before any call runs.

**What it is not.** The paper found that contracts do **not** reduce wrong
actions: the wrong-target rate stayed at 40–49% in every condition. Treat
ContractGate as an audit trail and a partial-execution layer, never as a
safety gate. TargetGate and ConseqGate still guard what an action does.

## Rollout: shadow first

Owner decision, 2026-11-23: start in shadow mode, paired with ChoiceCall.

| Mode            | Call                                                   | Effect                                                                                                                                 |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Shadow (now)    | `gate.shadow(contract, user_messages, observed_calls)` | Logs the contract and whether each call that the current path already made was in scope. Runs nothing, blocks nothing, raises nothing. |
| Enforce (later) | `gate.step(contract, user_messages)`                   | Seals the contract, asks the executor for calls, and runs only in-scope ones.                                                          |

Shadow statuses:

- `SHADOW_IN_SCOPE`: every observed call is inside the contract.
- `SHADOW_PARTIAL`: some calls are outside the contract.
- `SHADOW_OUT_OF_SCOPE`: no call is inside the contract.
- `SHADOW_REJECTED`: the contract fails validation. The reason is logged.
- `SHADOW_NO_CONTRACT`: the planner gave no contract.

`write_shadow_log(gate.log, path)` appends the sealed rows as JSONL, in the same
style as the ConseqGate receipts. Compare a week of rows against those receipts
before switching any path to `step`.

## Pairing with ChoiceCall

`choicecall_executor(caller, to_call)` uses a ChoiceCall caller
(`agentz/core/choice_call.py`, build 2026-11-22) as the trusted executor. The
request it sees is only the contract's quote and goal, so every argument value
is an enum member or a span of those words. When ChoiceCall declines or needs
input, the step makes no call instead of guessing.

## Not done here

- No bot is routed through ContractGate yet. The build's next step is the
  research bot's `project_write`, which does not live in this repository.
- The `agent_contracts` table in the build spec is proposed SQL and is not applied.
