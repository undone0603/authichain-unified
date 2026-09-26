# Leave cold outreach off

Issue: none
Source: AuthiChain Board autopilot
Written: 2026-09-23T14:22:58.318Z

## Increment: Keep cold outreach disabled

### Outcome
Cold outreach stays off. `outreach-trigger` and `dpp-outreach` remain disabled; EU DPP and QRON send paths stay inert. Genesis cron keeps its weekday tick only and does not send mail.

### Files to touch
- `workers/cron/genesis.ts` (or equivalent Genesis schedule entry)
- `workers/outreach/outreach-trigger.ts` — confirm disabled / no schedule bind
- `workers/outreach/dpp-outreach.ts` — confirm disabled / no schedule bind
- `wrangler.toml` / worker route config — no cron or queue consumers for outreach senders
- `README.md` or `docs/ops-cron.md` — note outreach left off (domain bounce / empty queues)

### Acceptance checks
- [ ] No cron, queue consumer, or route invokes `outreach-trigger` or `dpp-outreach`
- [ ] Genesis weekday tick still registers; handler performs non-mail work only
- [ ] No mail send calls on Genesis, DPP, or QRON paths in this change
- [ ] Config/docs state cold outreach must not be re-enabled without explicit follow-up

### Patch sketch
```diff
# wrangler.toml / cron bindings
- # crons = ["...", "outreach-trigger", "dpp-outreach"]
+ # cold outreach OFF — do not bind outreach-trigger or dpp-outreach
+ # EU DPP / QRON send queues intentionally empty (domain bounce)

# workers/cron/genesis.ts
  export default {
    async scheduled(event, env, ctx) {
      // Weekday tick only — no mail
      if (!isWeekday(event.scheduledTime)) return;
      await runGenesisTick(env); // metrics/state only; no send
    }
  };

# workers/outreach/outreach-trigger.ts & dpp-outreach.ts
+ // DISABLED: leave cold outreach off. Do not schedule or export handlers.
+ export default { async fetch() { return new Response(null, { status: 404 }); } };
```
