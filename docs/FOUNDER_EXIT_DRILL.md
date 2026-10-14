# Founder-exit drill

Isolated test. No Stripe call, no mail, no migration, no production worker.

Run:

```bash
pnpm exec vitest run src/lib/founder-exit/ledger.test.ts
```

The machine-readable result committed from the passing run is `docs/evidence/founder-exit-drill.json`. The test fails if the live report differs from that file.

## Scenario

The clock is fixed at `2026-10-13T20:00:00.000Z`.

1. `act_interrupt` (`retry_idempotent`, idempotency key `effect-1`) is authorized and leased to `agent-a`.
2. The side effect is recorded.
3. The worker stops before the ledger records success. The lease then expires.
4. `recover` finds the side effect, finalizes the same action id, and does not apply the effect again.
5. `act_continue` stays `authorized`.
6. `agent-a` is revoked. A new inspect is stored as `denied`. The revoked agent cannot start `act_resume`.
7. `agent-b` resumes `act_resume` because that action was already permitted and `agent-b` holds `retry_idempotent`.
8. `send_outbound` and `charge` from `agent-b` stay `blocked` even though the capabilities are present. There is no standing approval.
9. A temp file is killed after the side-effect write and reloaded. The reloaded recovery still applies the effect once.
10. Fault injections cover database timeout, duplicate create, worker termination, expired lease, provider timeout, duplicate side effect, revoked agent, missing capability, approval hold, missing evidence, economic separation, missing secret, scheduler delay, retry exhaustion, redaction, and append-only history.

## Replica interruption

Separate from the CI drill. Run Postgres 16 on `127.0.0.1:55432` with database `founder_exit`, then:

```bash
FOUNDER_EXIT_DATABASE_URL=postgres://postgres@127.0.0.1:55432/founder_exit \
  pnpm exec tsx scripts/founder-exit-replica-drill.ts
```

The script refuses any host that is not loopback. It applies only `supabase/migrations/20261013232408_founder_exit_action_ledger.sql`, truncates the two new tables, leaves one action `running` with its side-effect key committed, dumps that local database, drops it, restores it, and then recovers the same action id. The machine-readable result is `docs/evidence/founder-exit-replica-drill.json`.

## What a pass does not mean

Every criterion in the isolated JSON can be `pass` while the company is still not founder-independent. The replica drill proves dump, restore, and one recovered side effect on an empty local schema. It does not prove a live $299 grant, a restored production customer backup, or a deployed outbound send. The production ledger tables are still empty. Source on this branch writes them from `fulfillDppPaidSession`. Deployed workers do not until this branch ships. Those limits remain in `docs/FOUNDER_INDEPENDENCE.md`.
