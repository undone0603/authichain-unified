import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { ExecutiveAgent } from "../agents/executive";

const agent = new ExecutiveAgent();
type ActionInput = Record<string, unknown>;

// One entry per ExecutiveAgent content-generation method. `run` receives the
// parsed JSON input object for that action and returns the generated text.
const ACTIONS = {
  draftSalesEmail: {
    label: "Sales Email",
    description: "Cold sales email personalized to a prospect.",
    example: { name: "Jane Doe", company: "Acme Cannabis Co", title: "COO", industry: "Cannabis", painPoints: ["counterfeit product recalls"] },
    run: (input: ActionInput) => agent.draftSalesEmail(input),
  },
  draftPartnershipEmail: {
    label: "Partnership Email",
    description: "Partnership proposal email.",
    example: { name: "Jane Doe", company: "Acme Labs", type: "Technology Integration", proposedIntegration: "METRC data sync", benefits: ["shared compliance data"] },
    run: (input: ActionInput) => agent.draftPartnershipEmail(input),
  },
  generateLinkedInPost: {
    label: "LinkedIn Post",
    description: "Full LinkedIn post on a topic.",
    example: { topic: "Michigan cannabis tax compliance" },
    run: (input: ActionInput) => agent.generateLinkedInPost(String(input.topic ?? ""), typeof input.options === "object" ? input.options as Record<string, unknown> : undefined),
  },
  generateBlogPost: {
    label: "Blog Post",
    description: "Long-form blog post (short/medium/long).",
    example: { topic: "Why blockchain authentication stops counterfeit pharma", length: "medium", keywords: ["blockchain", "authentication"] },
    run: (input: ActionInput) => agent.generateBlogPost(String(input.topic ?? ""), typeof input.length === "string" ? input.length : undefined, Array.isArray(input.keywords) ? input.keywords.map(String) : undefined),
  },
  generateProductAnnouncement: {
    label: "Product Announcement",
    description: "Email + social + in-app copy for a new feature launch.",
    example: { featureName: "Bitcoin Ordinals Proof", description: "Products can now carry a Bitcoin L1 inscription", benefits: ["tamper-evident", "permanent"], releaseDate: "2026-07-12" },
    run: (input: ActionInput) => agent.generateProductAnnouncement(input),
  },
  generateSocialMediaContent: {
    label: "Social Post (any platform)",
    description: "Platform-tuned post (twitter/linkedin/instagram/facebook).",
    example: { platform: "twitter", topic: "supply chain fraud prevention", style: "professional" },
    run: (input: ActionInput) => agent.generateSocialMediaContent(String(input.platform ?? ""), String(input.topic ?? ""), typeof input.style === "string" ? input.style : undefined),
  },
  analyzeCompetitor: {
    label: "Competitor Analysis",
    description: "Positioning strategy against a named competitor.",
    example: { name: "Everest", features: ["NFC tags"], pricing: "$0.10/tag", strengths: ["hardware partnerships"], weaknesses: ["no compliance bridge"] },
    run: (input: ActionInput) => agent.analyzeCompetitor(input),
  },
  summarizeText: {
    label: "Summarize Text",
    description: "Summarize arbitrary text.",
    example: { text: "Paste text to summarize here.", maxWords: 100, style: "concise" },
    run: (input: ActionInput) => agent.summarizeText(String(input.text ?? ""), typeof input.maxWords === "number" ? input.maxWords : undefined, typeof input.style === "string" ? input.style : undefined),
  },
  improveWriting: {
    label: "Improve Writing",
    description: "Polish/rewrite arbitrary text.",
    example: { text: "Paste text to improve here.", style: "professional", purpose: "marketing" },
    run: (input: ActionInput) => agent.improveWriting(String(input.text ?? ""), typeof input.style === "string" ? input.style : undefined, typeof input.purpose === "string" ? input.purpose : undefined),
  },
  generateEmailCampaign: {
    label: "Email Campaign",
    description: "Subject lines + body + CTA options for a campaign.",
    example: { subject: "Cut counterfeit losses this quarter", audience: "Cannabis dispensary owners", goal: "Book a demo", keyPoints: ["METRC bridge", "Bitcoin-grade auth"] },
    run: (input: ActionInput) => agent.generateEmailCampaign(input),
  },
  generateFAQAnswer: {
    label: "FAQ Answer",
    description: "Draft a support FAQ answer.",
    example: { question: "How does the METRC bridge work?", category: "compliance" },
    run: (input: ActionInput) => agent.generateFAQAnswer(String(input.question ?? ""), typeof input.category === "string" ? input.category : undefined),
  },
  generateDailyBriefing: {
    label: "Daily Executive Briefing",
    description: "Morning briefing from platform metrics.",
    example: { revenue: 1200, newSignups: 5 },
    run: (input: ActionInput) => agent.generateDailyBriefing(input),
  },
} as const;

export type ExecutiveActionKey = keyof typeof ACTIONS;
const actionKeyEnum = z.enum(Object.keys(ACTIONS) as [ExecutiveActionKey, ...ExecutiveActionKey[]]);

export const executiveRouter = router({
  listActions: adminProcedure.query(() => {
    return Object.entries(ACTIONS).map(([key, a]) => ({
      key,
      label: a.label,
      description: a.description,
      example: a.example,
    }));
  }),

  generate: adminProcedure
    .input(z.object({ action: actionKeyEnum, input: z.record(z.string(), z.unknown()) }))
    .mutation(async ({ input }) => {
      const action = ACTIONS[input.action];
      const output = await action.run(input.input);
      return { output };
    }),
});
