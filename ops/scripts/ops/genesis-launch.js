/**
 * Compatibility shim. Canonical launcher is scripts/ops/genesis-launch.js.
 * Auth source of truth: CRON_SECRET (CRON_API_KEY is a deprecated alias).
 */
import { triggerGenesis } from "../../../scripts/ops/genesis-launch.js";

triggerGenesis();
