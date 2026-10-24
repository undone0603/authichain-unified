# Local Test Runbook for QRON Modes (CI billing lock workaround)

## Command
```bash
pnpm exec vitest run src/lib/qron-modes.ts src/lib/generate-api.ts --reporter=verbose
```

## Expected
- applyMode prepends promptSeed for valid ModeId
- Free sample and credit gate unchanged
- modeId present in 200 response when provided

## Observability
After deploy, check logs for modeId and UTM qr_footer clicks.

Cost $0. No new infra. Idempotent.
