# Prove-Value Dry-Run Results

**Branch:** `feature/minimal_violation_product`  
**Date:** 2026-08-31  
**Target narrative:** Ohio DCC / OAIS MVC — sell outcomes, not code

## Commands run

```bash
.venv/bin/python -m agentz.cli run govchain_pilot --mode dry-run
.venv/bin/python -m agentz.cli run authichain_compliance_audit --mode dry-run
.venv/bin/python -m agentz.cli run strainchain_pilot --mode dry-run
.venv/bin/python -m agentz.cli run launch.measure_pilot --mode dry-run
```

## Results (after dry-run unblocking)

| Workflow                      | Mode    | Status | Result summary                                                                   |
| :---------------------------- | :------ | :----- | :------------------------------------------------------------------------------- |
| `govchain_pilot`              | dry-run | **OK** | Project ID `dry-run-gov-project-id`; would publish living transparency page      |
| `strainchain_pilot`           | dry-run | **OK** | Product ID `dry-run-strain-id`; would generate StoryMode + living page + rewards |
| `authichain_compliance_audit` | dry-run | **OK** | 4-field mandate set; 0/1 compliant, 1 flagged (sample missing origin/material)   |
| `launch.measure_pilot`        | dry-run | **OK** | Would query scan counts / verification rates / engagement                        |

## Fixes applied to unblock dry-run

1. Skip `create_client` when `mode == dry-run` in gov/strain/compliance handlers (placeholders are not valid Supabase URLs).
2. Align compliance imports with `research_compliance_requirements` / `scan_product_compliance` (removed dead `research_dpp_requirements` / `run_global_compliance_audit` names).

## LOI status

Dry-runs now prove the **orchestration path** works without side effects. They do **not** yet produce measured “80% audit time reduction” evidence.

Next human steps:

1. Pick `pilot_client_x` (Ohio cultivator or academic partner).
2. Run a labeled sandbox with real timings → fill `docs/strategy/LOI_TEMPLATE_OAIS_PILOT.md`.
3. Legal review → signature request.
