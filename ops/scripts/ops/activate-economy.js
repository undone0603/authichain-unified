/**
 * Compatibility shim. Canonical activator is scripts/ops/activate-economy.js.
 */
import { activate } from "../../../scripts/ops/activate-economy.js";

activate().catch((err) => {
  console.error("❌ ACTIVATION FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
