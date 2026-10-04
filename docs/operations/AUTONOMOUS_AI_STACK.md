# Autonomous AI Operating Stack

AuthiChain uses a provider-neutral orchestration policy so models and tools can be swapped without rewriting business logic.

## Governance layer

The company is AI-operated and founder-governed. The operating charter and
switchboard define what agents may execute; they do not delegate legal,
financial, medical, or other material accountability to a model.

Every agent action needs a bounded authority, observable inputs and outputs,
an audit record, a failure mode, and an escalation path. Agent selection
optimizes for **fit × evidence × confidence × cost × latency × privacy**,
not for maximum automation.

Personal health or wearable data is excluded by default. Any future
founder-provided capacity signal must be explicit, minimum-necessary,
private, advisory-only, revocable, and limited to scheduling or
non-urgent-work prioritization.

## Operating layers

1. **Orchestrator** — classify the customer circumstance and select the workflow.
2. **Research** — gather current regulatory/company evidence.
3. **Evidence** — attach source, timestamp, confidence, and policy to material claims.
4. **Fit** — score urgency, pain, authentication/DPP need, data availability, buying signal, and budget.
5. **Revenue** — move qualified demand through HubSpot → Stripe → provisioning → activation → usage.
6. **Build** — turn approved GitHub work into tested PRs and deployments.
7. **Observability** — record model/tool choice, cost, latency, errors, business outcome, and guardrail status.

## Scaling loop

The stack may optimize only through a measurable, reversible loop:

`measure → propose → bounded experiment → verify → retain or revert`

Each experiment declares its metric, duration, spend/rate cap, rollback, and
escalation condition. An agent cannot increase a cap, make an irreversible
commercial commitment, or bypass consent, privacy, authentication, payment,
deliverability, or truth controls.

## Open-source-first candidates

- LangGraph: durable stateful orchestration.
- OpenHands: autonomous software-engineering execution.
- OpenCode/Aider: repository coding workflows.
- n8n: API/business workflow automation.
- Ollama + llama.cpp: local inference and model portability.
- LlamaIndex: retrieval and domain knowledge.
- Firecrawl: research/extraction.
- Langfuse: tracing and cost/quality observability.
- promptfoo: prompt/model evaluation.
- Playwright/Browser Use: browser verification and QA.

## Selection policy

The orchestrator optimizes for **fit × evidence × confidence × cost × latency × privacy**, not agent count.

No autonomous agent may claim a customer, revenue event, compliance conclusion, or retention state without observable evidence.

High-risk or low-confidence decisions escalate to a human. Routine fulfillment should not.

## First production target

Do not expand the agent surface until the DPP revenue loop passes its deployed end-to-end smoke test: attribution → checkout → payment → provisioning → activation → DPP publication → verification → retention.
