export type TextInput = {
  prompt: string;
  context?: string;
  audience?: string;
  tone?: "formal" | "casual" | "playful" | "serious";
};

export type EmailInput = TextInput & {
  subject?: string;
  product?: string;
  offer?: string;
};

export type SocialInput = TextInput & {
  platform?: "linkedin" | "twitter" | "instagram" | "facebook";
};

export type CompetitorInput = {
  name: string;
  url?: string;
  productLine?: string;
  notes?: string;
};

export type FAQInput = {
  question: string;
  product?: string;
  audience?: string;
};

export class ExecutiveAgent {
  draftSalesEmail(input: EmailInput): string {
    const subject = input.subject ?? `Quick note about ${input.product ?? "our solution"}`;
    return [
      `Subject: ${subject}`,
      "",
      "Hi,",
      "",
      input.prompt ??
        `I wanted to reach out about ${input.product ?? "our platform"} and how it can help you ${
          input.context ?? "hit your next set of growth targets"
        }.`,
      "",
      input.offer ? `We’re currently offering ${input.offer}.` : "",
      "",
      "If this sounds interesting, I’d be happy to share a short walkthrough.",
      "",
      "Best,",
      "ExecutiveAgent",
    ]
      .filter(Boolean)
      .join("\n");
  }

  draftPartnershipEmail(input: EmailInput): string {
    const subject = input.subject ?? "Exploring a potential partnership";
    return [
      `Subject: ${subject}`,
      "",
      "Hi,",
      "",
      input.prompt ??
        `I’ve been following your work in ${input.context ?? "your space"} and I think there’s a strong opportunity for us to collaborate.`,
      "",
      "I’d love to explore how a partnership could create value for both sides—whether through co-marketing, product integration, or joint campaigns.",
      "",
      "If you’re open to it, could we schedule a brief call to compare notes?",
      "",
      "Best,",
      "ExecutiveAgent",
    ].join("\n");
  }

  generateLinkedInPost(input: SocialInput): string {
    return [
      "Platform: LinkedIn",
      "",
      input.prompt ??
        "Sharing a quick update on how we’re helping teams build trustworthy, tamper‑evident pipelines across their data and workflows.",
      "",
      input.context ? `Context: ${input.context}` : "",
      "",
      `If you’re working on ${input.audience ?? "scaling authentic, verifiable systems"}, this might be relevant.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  generateBlogPost(input: TextInput): string {
    return [
      `Title: ${input.subject ?? "Building authentic, verifiable systems at scale"}`,
      "",
      input.prompt ??
        "In this post, we’ll walk through why authenticity, provenance, and tamper‑evidence are becoming core requirements for modern systems.",
      "",
      input.context
        ? `We’ll focus specifically on ${input.context}, and how teams can move from ad‑hoc scripts to autonomous, trustworthy pipelines.`
        : "",
      "",
      "We’ll cover:",
      "- The shift from opaque automation to transparent, auditable flows",
      "- How to design agents that act within clear guardrails",
      "- Practical steps to introduce authenticity without slowing teams down",
    ]
      .filter(Boolean)
      .join("\n");
  }

  generateProductAnnouncement(input: TextInput): string {
    return [
      `Subject: ${input.subject ?? "New release: authentic, autonomous pipelines"}`,
      "",
      "We’re excited to announce a new set of capabilities designed to make your pipelines both autonomous and verifiable.",
      "",
      input.prompt ??
        "With this release, teams can wire agents into their workflows while keeping a clear, tamper‑evident record of what happened and why.",
      "",
      input.context ? `This is especially useful for ${input.context}.` : "",
      "",
      "You can start using these features today in your existing environment—no major migration required.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  generateSocialMediaContent(input: SocialInput): string {
    const platform = input.platform ?? "twitter";
    return [
      `Platform: ${platform}`,
      "",
      input.prompt ??
        "Autonomous systems are powerful—but without authenticity and provenance, they’re just black boxes. We’re changing that.",
      "",
      input.context ? `Context: ${input.context}` : "",
      "",
      "#authenticity #agents #provenance",
    ]
      .filter(Boolean)
      .join("\n");
  }

  analyzeCompetitor(input: CompetitorInput): string {
    return [
      `Competitor analysis: ${input.name}`,
      input.url ? `URL: ${input.url}` : "",
      "",
      "Focus areas:",
      `- Product positioning: ${input.productLine ?? "not specified"}`,
      "- Differentiation:",
      "  • Where they lean on automation vs authenticity",
      "  • How clearly they communicate trust, provenance, and guardrails",
      "",
      input.notes ? `Additional notes: ${input.notes}` : "",
      "",
      "Opportunities:",
      "- Emphasize transparent, tamper‑evident flows",
      "- Show how agents act within clear, auditable constraints",
    ]
      .filter(Boolean)
      .join("\n");
  }

  summarizeText(input: TextInput): string {
    return [
      "Summary:",
      "",
      input.prompt ??
        "This text focuses on building authentic, verifiable systems and the tradeoffs between speed and trust.",
      "",
      input.context ? `Context: ${input.context}` : "",
      "",
      "Key points:",
      "- Authenticity and provenance are becoming baseline requirements",
      "- Autonomous agents must operate within clear guardrails",
      "- Teams need practical patterns, not just theory",
    ]
      .filter(Boolean)
      .join("\n");
  }

  improveWriting(input: TextInput): string {
    return [
      "Improved version:",
      "",
      input.prompt
        ? `Let’s make this clearer and more direct:\n\n${input.prompt}`
        : "We help teams build autonomous pipelines that are both powerful and trustworthy—every action is traceable, every decision auditable.",
      "",
      `Tone: ${input.tone ?? "neutral"}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  generateEmailCampaign(input: EmailInput): string {
    const subject = input.subject ?? "Bringing authenticity to autonomous systems";
    return [
      `Campaign subject: ${subject}`,
      "",
      "Email 1: Problem",
      "- Highlight the risk of opaque automation",
      "- Show why authenticity and provenance matter",
      "",
      "Email 2: Solution",
      "- Introduce your authentic, agentic pipeline",
      "- Explain how it keeps a tamper‑evident record of actions",
      "",
      "Email 3: Proof",
      "- Share a case study or example",
      "- Invite readers to try a small, low‑risk pilot",
    ].join("\n");
  }

  generateFAQAnswer(input: FAQInput): string {
    return [
      `Q: ${input.question}`,
      "",
      "A:",
      input.prompt ??
        "We designed our system to make autonomous workflows both powerful and trustworthy. Every action is recorded in a tamper‑evident, auditable format.",
      "",
      input.product ? `This applies directly to ${input.product}.` : "",
      input.audience ? `For ${input.audience}, this means clearer accountability and easier audits.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
}
