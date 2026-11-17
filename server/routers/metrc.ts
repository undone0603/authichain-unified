import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { metrcUnavailable } from "../metrc-unavailable";

export const metrcRouter = router({
  /**
   * METRC sync is off. This does not call the network.
   */
  sync: protectedProcedure
    .input(z.object({
      licenseNumber: z.string(),
      vendorKey: z.string().optional(),
      userKey: z.string().optional(),
    }))
    .mutation(async () => {
      return metrcUnavailable();
    }),

  /**
   * METRC anchoring is off. This does not write a chain transaction.
   */
  anchor: protectedProcedure
    .input(z.object({
      packageTag: z.string(),
      manifestId: z.string(),
    }))
    .mutation(async () => {
      return metrcUnavailable();
    }),

  /**
   * No live METRC census. The old counts were invented.
   */
  stats: publicProcedure.query(async () => {
    return metrcUnavailable();
  }),
});
