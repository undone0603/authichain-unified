import { adminProcedure, router } from "../_core/trpc";
import { getFounderSnapshot } from "./snapshot";

/**
 * Founder ops dashboard — read-only synthesizer over the autonomous business.
 * One endpoint, one payload, no writes, no sends. Admin-only.
 */
export const founderRouter = router({
  snapshot: adminProcedure.query(async () => {
    return await getFounderSnapshot();
  }),
});
