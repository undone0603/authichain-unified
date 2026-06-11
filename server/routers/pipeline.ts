import { router, protectedProcedure } from "../_core/trpc";
import { runPipelineTick } from "../jobs/pipeline-tick";

export const pipelineRouter = router({
  status: protectedProcedure.query(async () => {
    const result = await runPipelineTick();
    return { ...result, ranAt: new Date().toISOString(), missionTasks: (result as any).missionTasks ?? ([] as any[]) };
  }),
});
