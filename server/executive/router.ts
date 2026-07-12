import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { ExecutiveAgent } from "../agents/executive";

const agent = new ExecutiveAgent();

// One entry per ExecutiveAgent content-generation method. `run` receives the
// parsed JSON input object for that action and returns the generated text.
const ACTIONS = {
  draftSalesEmail: {
    label: "Sales Email",
    description: "Cold sales email personalized to a prospect.",
    example: { name: "Jane Doe", company: "Acme Cannabis Co", title: "COO", industry: "Cannabis", painPoints: ["counterfeit product recalls"] },
    run: (input: any) => agent.draftSalesEmail(input),
  },
  draftPartnershipEmail: {
    label: "Partnership Email",
    description: "Partnership proposal email.",
    example: { name: "Jane Doe", company: "Acme Labs", type: "Technology Integration", proposedIntegration: "METRC data sync", benefits: ["shared compliance data"] },
    run: (input: any) => agent.draftPartnershipEmail(input),
  },
  generateLinkedInPost: {
    label: "LinkedIn Post",
    description: "Full LinkedIn post on a topic.",
    example: { topic: "Michigan cannabis tax compliance" },
    run: (input: any) => agent.generateLinkedInPost(input.topic, input.options),
  },
  generateBlogPost: {
    label: "Blog Post",
    description: "Long-form blog post (short/medium/long).",
    example: { topic: "Why blockchain authentication stops counterfeit pharma", length: "medium", keywords: ["blockchain", "authentication"] },
    run: (input: any) => agent.generateBlogPost(input.topic, input.length, input.keywords),
  },
  generateProductAnnouncement: {
    label: "Product Announcement",
    description: "Email + social + in-app copy for a new feature launch.",
    example: { featureName: "Bitcoin Ordinals Proof", description: "Products can now carry a Bitcoin L1 inscription", benefits: ["tamper-evident", "permanent"], releaseDate: "2026-07-12" },
    run: (input: any) => agent.generateProductAnnouncement(input),
  },
  generateSocialMediaContent: {
    label: "Social Post (any platform)",
    description: "Platform-tuned post (twitter/linkedin/instagram/facebook).",
    example: { platform: "twitter", topic: "supply chain fraud prevention", style: "professional" },
    run: (input: any) => agent.generateSocialMediaContent(input.platform, input.topic, input.style),
  },
  analyzeCompetitor: {
    label: "Competitor Analysis",
    description: "Positioning strategy against a named competitor.",
    example: { name: "Everest", features: ["NFC tags"], pricing: "$0.10/tag", strengths: ["hardware partnerships"], weaknesses: ["no compliance bridge"] },
    run: (input: any) => agent.analyzeCompetitor(input),
  },
  summarizeText: {
    label: "Summarize Text",
    description: "Summarize arbitrary text.",
    example: { text: "Paste text to summarize here.", maxWords: 100, style: "concise" },
    run: (input: any) => agent.summarizeText(input.text, input.maxWords, input.style),
  },
  improveWriting: {
    label: "Improve Writing",
    description: "Polish/rewrite arbitrary text.",
    example: { text: "Paste text to improve here.", style: "professional", purpose: "marketing" },
    run: (input: any) => agent.improveWriting(input.text, input.style, input.purpose),
  },
  generateEmailCampaign: {
    label: "Email Campaign",
    description: "Subject lines + body + CTA options for a campaign.",
    example: { subject: "Cut counterfeit losses this quarter", audience: "Cannabis dispensary owners", goal: "Book a demo", keyPoints: ["METRC bridge", "Bitcoin-grade auth"] },
    run: (input: any) => agent.generateEmailCampaign(input),
  },
  generateFAQAnswer: {
    label: "FAQ Answer",
    description: "Draft a support FAQ answer.",
    example: { question: "How does the METRC bridge work?", category: "compliance" },
    run: (input: any) => agent.generateFAQAnswer(input.question, input.category),
  },
  generateDailyBriefing: {
    label: "Daily Executive Briefing",
    description: "Morning briefing from platform metrics.",
    example: { revenue: 1200, newSignups: 5 },
    run: (input: any) => agent.generateDailyBriefing(input),
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
    .input(z.object({ action: actionKeyEnum, input: z.record(z.string(), z.any()) }))
    .mutation(async ({ input }) => {
      const action = ACTIONS[input.action];
      const output = await action.run(input.input);
      return { output };
    }),
});
