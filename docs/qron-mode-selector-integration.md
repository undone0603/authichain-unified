# QRON Mode Selector + Viral Footer

Draft integration for self-serve Launch Pack modes.

## Events to log
- mode_select {mode_id}
- gen_start_with_mode {mode_id, anonymous}
- gen_complete_with_mode {mode_id, object_id}
- qr_scan_from_mode {mode_id, object_id}
- footer_cta_click {mode_id, utm_source: "qr_footer"}

## Notes
- Matches CORE_MODES in workers/qron-space/src/mode-usage-cron.ts (extended)
- Zero new infra cost
- Do not merge until Stripe prices reconciled (Starter $199/mo, Launch Pack $39 one-time)
