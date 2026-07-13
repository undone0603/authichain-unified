/**
 * AuthiChain Executive Agent
 * Advanced autonomous agent for sales, marketing, and strategic operations.
 * Ports the AIExecutiveAssistant from premium branch to Unified stack —
 * NFT-marketplace-specific methods (description/collection/listing copy) and
 * content templates that hardcode a wallet-connect/mint/gas-fee product flow
 * were dropped, since that isn't what AuthiChain's product actually is.
 */
import { invokeLLM } from "../_core/llm";

export const AUTHICHAIN_CONTEXT = {
  company: "AuthiChain",
  tagline: "The Truth Layer for the Physical World",
  product: "Multi-Chain Authentication & Industrial Audit Protocol",

  domains: {
    core: "authichain.com",
    creative: "qron.space",
    compliance: "strainchain.io",
    regulatory: "govchain.us"
  },

  features: [
    "Bitcoin L1 Inscriptions (Dual-chain: Polygon + BTC Ordinals)",
    "ProductDNA™ AI Image Analysis (GPT-4o Vision)",
    "BrandVoice™ Dynamic Audio Storytelling (OpenAI TTS)",
    "METRC & BioTrack Seed-to-Sale Compliance Bridge",
    "Stripe Connect v2 direct balance billing",
    "Real-time Regulatory Audit Trails (Michigan CRA compliant)",
    "White-label Enterprise Verification Marketplace"
  ],

  targetAudiences: [
    "Cannabis cultivators and dispensaries",
    "Luxury goods and fashion brands",
    "Government procurement offices",
    "Pharmaceutical manufacturers",
    "Electronics and automotive parts suppliers",
  ],

  useCases: [
    "Blockchain-verified product authentication at point of sale",
    "METRC seed-to-sale compliance reporting for cannabis operators",
    "Government supply-chain fraud prevention",
    "Anti-counterfeit brand protection for luxury goods",
  ],

  valuePropositions: {
    trust: "Every scan is cryptographically verifiable, not just a claim",
    compliance: "Regulatory audit trails generated automatically, not bolted on",
    cost: "Stops counterfeit losses before they hit the balance sheet",
  },

  competitiveAdvantages: [
    "Dual-chain proof (Polygon + Bitcoin Ordinals) — not a single point of failure",
    "Built-in compliance bridge (METRC/BioTrack), not a separate integration",
    "Multi-vertical from day one: cannabis, luxury, government, pharma",
  ],

  monetization: {
    creator: { price: "$29/mo", fee: "5%" },
    pro: { price: "$79/mo", fee: "3%" },
    enterprise: { price: "$299/mo", fee: "1.5%" },
    agency: { price: "$999/mo", fee: "0%" }
  }
};

export class ExecutiveAgent {
  private async callLLM(prompt: string, maxTokens = 2000): Promise<string> {
    const response = await invokeLLM({
      messages: [{ role: "system", content: prompt }],
      maxTokens,
    });
    return response.choices[0].message.content as string;
  }

  /**
   * Drafts a targeted sales email for the Michigan Margin Protection campaign.
   */
  async draftMarginProtectionEmail(prospect: any) {
    const prompt = `Draft a high-urgency sales email for the Michigan Cannabis 24% wholesale tax panic.

    Prospect: ${prospect.name} at ${prospect.company} (${prospect.dba})
    Industry: ${prospect.industry}
    City: ${prospect.city}

    Context:
    ${JSON.stringify(AUTHICHAIN_CONTEXT)}

    Requirements:
    - Mention specific city and processor/microbusiness status.
    - Highlight the $299 StrainChain BTC Auth product.
    - Mention ProductDNA visual markers and BrandVoice audio storytelling.
    - Professional, "insider" tone. No sales fluff.
    - Under 130 words.`;

    return this.callLLM(prompt);
  }

  /**
   * Generates a LinkedIn "Surround" message for the 11 Michigan vectors.
   */
  async generateLinkedInSurround(lead: any) {
    const prompt = `Generate a concise LinkedIn connection request for: ${lead.name} at ${lead.company}.
    They just received an email about "Margin Protection" for their ${lead.type} in ${lead.city}.

    Product: StrainChain (Bitcoin Inscribed certs).
    Tone: Collaborative peer.
    Max 300 characters.`;

    return this.callLLM(prompt);
  }

  /**
   * Generates a Daily Executive Briefing based on platform metrics.
   */
  async generateDailyBriefing(metrics: any) {
    const prompt = `You are the AuthiChain Executive Assistant. Generate a concise morning briefing.
    Metrics: ${JSON.stringify(metrics)}
    Context: ${JSON.stringify(AUTHICHAIN_CONTEXT)}
    Include: 3 Highlights, 3 Priorities for Today, and 1 Strategic Recommendation.`;

    return this.callLLM(prompt);
  }

  // ===== SALES & OUTREACH =====

  async draftSalesEmail(prospect: {
    name: string; company: string; title: string; industry: string; painPoints?: string[];
  }) {
    const { name, company, title, industry, painPoints = [] } = prospect;
    const prompt = `Draft a compelling sales email for AuthiChain.

Prospect Information:
- Name: ${name}
- Company: ${company}
- Title: ${title}
- Industry: ${industry}
${painPoints.length > 0 ? `- Pain Points: ${painPoints.join(', ')}` : ''}

AuthiChain Product:
${AUTHICHAIN_CONTEXT.product} - ${AUTHICHAIN_CONTEXT.tagline}

Key Features:
${AUTHICHAIN_CONTEXT.features.slice(0, 5).map((f) => `• ${f}`).join('\n')}

Value Propositions:
${Object.values(AUTHICHAIN_CONTEXT.valuePropositions).map((v) => `• ${v}`).join('\n')}

Competitive Advantages:
${AUTHICHAIN_CONTEXT.competitiveAdvantages.join('\n')}

Requirements:
- Personalize to their role, industry, and pain points
- Address specific challenges (counterfeits, authentication, brand protection, revenue loss)
- Clear, compelling value proposition
- Include 1-2 social proof elements (without making up specific names)
- Soft CTA: Ask for 15-min discovery call
- Professional yet approachable tone
- Under 130 words (body only)
- Include subject line

Generate the email:`;

    return this.callLLM(prompt, 1200);
  }

  async draftPartnershipEmail(partner: {
    name: string; company: string; type: string; proposedIntegration: string; benefits?: string[];
  }) {
    const { name, company, type, proposedIntegration, benefits = [] } = partner;
    const prompt = `Draft a partnership proposal email for AuthiChain.

Partner Information:
- Contact: ${name} at ${company}
- Partnership Type: ${type}
- Proposed Integration: ${proposedIntegration}
${benefits.length > 0 ? `- Mutual Benefits: ${benefits.join(', ')}` : ''}

AuthiChain Overview:
${AUTHICHAIN_CONTEXT.product} - ${AUTHICHAIN_CONTEXT.tagline}

Key Features: ${AUTHICHAIN_CONTEXT.features.slice(0, 4).join(', ')}

Requirements:
- Highlight mutual value and benefits
- Specific integration opportunities and technical synergies
- Request partnership exploration call
- Professional, collaborative tone
- Under 160 words
- Include compelling subject line

Generate email:`;

    return this.callLLM(prompt, 1200);
  }

  // ===== MARKETING CONTENT =====

  async generateLinkedInPost(
    topic: string,
    options: { includeStats?: boolean; tone?: string; targetAudience?: string } = {},
  ) {
    const { includeStats = false, tone = 'professional', targetAudience = 'general' } = options;
    const prompt = `Create an engaging LinkedIn post for AuthiChain about: ${topic}

AuthiChain Context:
- ${AUTHICHAIN_CONTEXT.product}
- ${AUTHICHAIN_CONTEXT.tagline}
- Target Audience: ${targetAudience !== 'general' ? targetAudience : AUTHICHAIN_CONTEXT.targetAudiences.slice(0, 3).join(', ')}

Requirements:
- 190-230 words
- Strong, attention-grabbing opening hook related to product authentication, supply-chain trust, or blockchain verification
- Include 1-2 specific insights about ${topic}
- Address common pain points (counterfeits, trust issues, compliance costs, brand risk)
${includeStats ? '- Include 1-2 relevant statistics or data points (real, verifiable stats only)' : ''}
- Provide actionable takeaways or thought-provoking perspectives
- End with an engaging question to drive comments and discussion
- Add 4-6 relevant hashtags
- ${tone === 'professional' ? 'Professional yet conversational' : tone} tone
- NO emojis in main text (can use sparingly in hashtag section)

Generate the post:`;

    return this.callLLM(prompt, 1200);
  }

  async generateBlogPost(topic: string, length: 'short' | 'medium' | 'long' = 'medium', keywords: string[] = []) {
    const wordCounts = { short: '600-800', medium: '1200-1600', long: '2200-2800' };
    const prompt = `Write a ${length} blog post (${wordCounts[length]} words) for the AuthiChain blog about: ${topic}

AuthiChain Overview:
${AUTHICHAIN_CONTEXT.product} - ${AUTHICHAIN_CONTEXT.tagline}

Target Audience: ${AUTHICHAIN_CONTEXT.targetAudiences.join(', ')}

Use Cases:
${AUTHICHAIN_CONTEXT.useCases.map((uc) => `• ${uc}`).join('\n')}

${keywords.length > 0 ? `Target Keywords: ${keywords.join(', ')}` : ''}

Requirements:
- Compelling, SEO-optimized headline (H1)
- Engaging introduction with hook and clear thesis
- 4-6 main sections with descriptive subheadings (H2/H3)
- Include specific examples related to product authentication, blockchain verification, or supply-chain compliance
- Address reader pain points and provide solutions
- Actionable insights and practical takeaways
- Strong conclusion with a clear CTA
- SEO-friendly (naturally incorporate keywords: authentication, blockchain, verification, compliance)
- Professional yet accessible tone
- Format in markdown

Generate the blog post:`;

    return this.callLLM(prompt, 4096);
  }

  async generateProductAnnouncement(feature: {
    featureName: string; description: string; benefits: string[]; releaseDate: string; targetUsers?: string;
  }) {
    const { featureName, description, benefits, releaseDate, targetUsers = 'all users' } = feature;
    const prompt = `Create a product announcement for AuthiChain's new feature.

Feature Information:
- Feature Name: ${featureName}
- Description: ${description}
- Key Benefits: ${benefits.join(', ')}
- Release Date: ${releaseDate}
- Target Users: ${targetUsers}

AuthiChain Context:
${AUTHICHAIN_CONTEXT.product} - ${AUTHICHAIN_CONTEXT.tagline}

Requirements:
- Exciting but professional tone
- Clear value proposition and user benefits
- Specific use cases showing how to use the feature
- Strong CTA to try the feature
- Keep each version concise and punchy

Generate 3 versions:

1. **Email Announcement** (Subject + Body, 160-180 words)
2. **Social Media Post** (LinkedIn/Twitter, 120-140 words)
3. **In-App Notification** (60-80 words)`;

    return this.callLLM(prompt, 2500);
  }

  async generateSocialMediaContent(platform: string, topic: string, style = 'professional') {
    const platformGuidelines: Record<string, { maxWords: number; tone: string; hashtagCount: number }> = {
      twitter: { maxWords: 50, tone: 'concise', hashtagCount: 3 },
      linkedin: { maxWords: 200, tone: 'professional', hashtagCount: 5 },
      instagram: { maxWords: 150, tone: 'visual', hashtagCount: 10 },
      facebook: { maxWords: 120, tone: 'conversational', hashtagCount: 3 },
    };
    const guide = platformGuidelines[platform.toLowerCase()] ?? platformGuidelines.linkedin;

    const prompt = `Create ${platform} content for AuthiChain about: ${topic}

AuthiChain: ${AUTHICHAIN_CONTEXT.product}

Platform: ${platform}
Style: ${style}
Max Words: ${guide.maxWords}

Requirements:
- ${guide.tone} tone optimized for ${platform}
- Strong opening hook
- Clear value/insight related to product authentication or blockchain verification
- ${platform.toLowerCase() === 'instagram' ? 'Suggest visual elements (image/video ideas)' : ''}
- Include ${guide.hashtagCount} relevant hashtags
- Engagement-driving CTA

Generate the post:`;

    return this.callLLM(prompt, 800);
  }

  // ===== EXECUTIVE & ANALYTICS =====

  async analyzeCompetitor(competitor: {
    name: string; features?: string[]; pricing?: string; strengths?: string[]; weaknesses?: string[]; marketPosition?: string;
  }) {
    const { name, features = [], pricing, strengths = [], weaknesses = [], marketPosition } = competitor;
    const prompt = `Analyze competitor and provide AuthiChain positioning strategy.

Competitor: ${name}
- Features: ${features.join(', ')}
- Pricing: ${pricing ?? 'unknown'}
- Strengths: ${strengths.join(', ')}
- Weaknesses: ${weaknesses.join(', ')}
${marketPosition ? `- Market Position: ${marketPosition}` : ''}

AuthiChain Competitive Advantages:
${AUTHICHAIN_CONTEXT.competitiveAdvantages.map((a) => `• ${a}`).join('\n')}

AuthiChain Features:
${AUTHICHAIN_CONTEXT.features.map((f) => `• ${f}`).join('\n')}

Provide:
1. **Competitive Analysis Summary** - Key takeaways about competitor
2. **AuthiChain Differentiation** - How we stand out
3. **Messaging Recommendations** - What to emphasize in marketing
4. **Feature Gap Analysis** - What they have that we don't (and should we build it?)
5. **Pricing Strategy** - How to position our pricing
6. **Action Items** - 3-5 specific tactical recommendations

Format: Markdown with clear sections
Tone: Strategic, analytical, actionable

Generate analysis:`;

    return this.callLLM(prompt, 3500);
  }

  // ===== UTILITY METHODS =====

  async summarizeText(text: string, maxWords = 100, style: 'concise' | 'narrative' = 'concise') {
    const prompt = `Summarize the following text in ${maxWords} words or less.

Style: ${style}

Text:
${text}

Provide a ${style === 'concise' ? 'brief, bullet-point' : 'narrative'} summary that captures the key points, main arguments, and actionable insights.`;

    return this.callLLM(prompt, 600);
  }

  async improveWriting(text: string, style = 'professional', purpose: 'general' | 'marketing' | 'technical' = 'general') {
    const prompt = `Improve the following text with a ${style} tone for ${purpose} purpose.

Original Text:
${text}

Requirements:
- Enhance clarity and readability
- Improve engagement and impact
- Maintain core message and intent
- ${style === 'professional' ? 'Polish language, remove colloquialisms' : 'Adjust tone appropriately'}
- ${purpose === 'marketing' ? 'Add persuasive elements' : purpose === 'technical' ? 'Ensure accuracy and precision' : 'Optimize for purpose'}
- Fix grammar, punctuation, and style issues

Provide improved version:`;

    return this.callLLM(prompt, 2000);
  }

  async generateEmailCampaign(campaign: {
    subject: string; audience: string; goal: string; keyPoints?: string[]; tone?: string;
  }) {
    const { subject, audience, goal, keyPoints = [], tone = 'professional' } = campaign;
    const prompt = `Create an email campaign for AuthiChain.

Campaign Details:
- Subject: ${subject}
- Target Audience: ${audience}
- Campaign Goal: ${goal}
- Key Points: ${keyPoints.join(', ')}
- Tone: ${tone}

AuthiChain Context:
${AUTHICHAIN_CONTEXT.product} - ${AUTHICHAIN_CONTEXT.tagline}

Value Props: ${Object.values(AUTHICHAIN_CONTEXT.valuePropositions).join('; ')}

Generate:
1. **3 Subject Line Options** (A/B/C test variations)
2. **Email Body** (180-220 words)
3. **CTA Button Text** (2-3 options)

Format: Markdown with clear sections`;

    return this.callLLM(prompt, 2000);
  }

  async generateFAQAnswer(question: string, category = 'general') {
    const prompt = `Generate a comprehensive FAQ answer for AuthiChain.

Question: ${question}
Category: ${category}

AuthiChain Overview:
${AUTHICHAIN_CONTEXT.product}

Features: ${AUTHICHAIN_CONTEXT.features.slice(0, 6).join(', ')}

Requirements:
- Direct, clear answer to the question
- Step-by-step instructions if applicable
- Anticipate follow-up questions
- Professional, helpful tone
- 80-150 words
- If technical, simplify for non-technical users

Generate answer:`;

    return this.callLLM(prompt, 1000);
  }
}
