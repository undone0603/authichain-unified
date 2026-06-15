import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
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
<<<<<<< HEAD
    if (!success) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Failed to start job "${input.jobName}"`,
      });
    }
    return {
      success,
      message: `Job "${input.jobName}" started successfully`,
    };
=======
    if (!success) throw new TRPCError({ code: "NOT_FOUND", message: `Job "${input.jobName}" not found` });
    return { success, message: `Job "${input.jobName}" started successfully` };
>>>>>>> origin/add-agentz-editable
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
