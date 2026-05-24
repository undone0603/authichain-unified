import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { generateProductAssets, retryFailedAssets } from "../asset-service";

export const productsRouter = router({
  /**
   * Triggers industrial asset generation (DNA + Audio) for a product.
   */
  generateAssets: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ input }) => {
      await generateProductAssets(input.productId);
      return { success: true };
    }),

  /**
   * Admin: Retries failed asset generation tasks.
   */
  retryFailedTasks: adminProcedure
    .mutation(async () => {
      await retryFailedAssets();
      return { success: true };
    }),
});
