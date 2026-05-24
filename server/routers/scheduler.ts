import { adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { 
  getRegisteredJobs, 
  getJobHistory, 
  runJobManually, 
  getSystemStatus, 
  toggleKillSwitch 
} from "../scheduled-jobs";

export const schedulerRouter = router({
  listJobs: adminProcedure.query(() => {
    return getRegisteredJobs();
  }),
  getHistory: adminProcedure.input(z.object({
    jobName: z.string().optional(),
    limit: z.number().optional().default(50),
  })).query(({ input }) => {
    return getJobHistory(input.jobName, input.limit);
  }),
  runManually: adminProcedure.input(z.object({
    jobName: z.string(),
  })).mutation(async ({ input }) => {
    const success = await runJobManually(input.jobName);
    return { 
      success, 
      message: success ? `Job "${input.jobName}" started successfully` : `Failed to start job "${input.jobName}"` 
    };
  }),
  getSystemStatus: adminProcedure.query(() => {
    return getSystemStatus();
  }),
  toggleSystemState: adminProcedure.input(z.object({
    active: z.boolean(),
  })).mutation(async ({ input }) => {
    const isActive = await toggleKillSwitch(input.active);
    return {
      success: true,
      isActive,
      message: `System ${isActive ? "activated" : "deactivated"} successfully`,
    };
  }),
});
