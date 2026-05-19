import { router, publicProcedure } from "../../_core/trpc";
import { z } from "zod";
import { db } from "../../db";
import { schema } from "../../../drizzle/schema";
import { CodeWriter } from "./code-writer";
import { GitHubService } from "./github-service";
import { PRManager } from "./pr-manager";
import { TestRunner } from "./test-runner";

export const devTeamRouter = router({
  writeCode: publicProcedure
    .input(z.object({ prompt: z.string() }))
    .mutation(async ({ input }) => {
      const writer = new CodeWriter();
      return await writer.write(input.prompt);
    }),
  runTests: publicProcedure
    .input(z.object({ testPath: z.string() }))
    .query(async ({ input }) => {
      const runner = new TestRunner();
      return await runner.run(input.testPath);
    }),
  managePR: publicProcedure
    .input(z.object({ action: z.string(), prNumber: z.number() }))
    .mutation(async ({ input }) => {
      const manager = new PRManager();
      return await manager.handle(input.action, input.prNumber);
    }),
  status: publicProcedure.query(() => {
    return { status: "active" };
  })
});
