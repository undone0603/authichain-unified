import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";

export const aiRouter = router({
  chat: protectedProcedure.input(z.object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })),
  })).mutation(async ({ input }) => {
    const systemPrompt = "You are AuthiChain AI, an expert assistant for product authentication, blockchain verification, supply chain management, and anti-counterfeiting. Help users understand authentication results, manage their products, and optimize their supply chain security.";
    const messages = [{ role: "system" as const, content: systemPrompt }, ...input.messages];
    const response = await invokeLLM({ messages });
    return { content: response.choices?.[0]?.message?.content || "I apologize, I could not generate a response." };
  }),
});
