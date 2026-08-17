import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
export const storymodeRouter = router({
    getChapters: publicProcedure
        .input(z.object({ skuId: z.string() }))
        .query(async ({ input }) => {
        // In a real app, this would query the db.storymodeChapters table
        // For now, implementing mock fetching based on catalog
        return [
            { chapterId: 'trailer', title: 'Chapter 0 · Trailer', contentUrl: '', free: true },
            { chapterId: 'origin', title: 'Chapter 1 · Origin', contentUrl: '', free: false },
        ];
    }),
});
