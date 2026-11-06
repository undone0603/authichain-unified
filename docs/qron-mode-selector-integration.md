# QRON Mode Selector + Viral Footer Integration

Files added on branch `feat/qron-mode-selector-viral-footer`:

- `src/lib/qron-modes.ts` — PORTAL_MODES matching CORE_MODES in workers/qron-space/src/mode-usage-cron.ts (stellar_seal, batch_verify, limited_drop + two extensions)
- `src/components/ModeSelector.tsx` — drop into the /generate flow
- `src/components/ViralFooter.tsx` — drop into the resolve/destination page

## Integration steps (manual, ~30 min)

1. In the generate page/component, import and render `<ModeSelector onSelect={handleModeSelect} />`.
2. On mode select, seed the prompt with `PORTAL_MODES[modeId].promptSeed` and log `mode_select`.
3. On generation complete, log `gen_complete_with_mode`.
4. On the QR resolve page, render `<ViralFooter modeId={modeId} />`.
5. Wire structured logs to Workers/D1 (already partially present via mode-usage-cron).

## Next (founder-only)

- Reconcile Stripe prices to match Drive pricing.ts (Starter $199/mo, Launch Pack $39 one-time).
- Approve PR merge + deploy after review.

No merge performed. No Stripe changes. No prod deploy.
