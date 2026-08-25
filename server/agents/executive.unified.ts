/**
 * Unified Executive Agent - Sales, Marketing & Strategic Operations
 * Implements AbstractAgent interface for unified orchestration
 */

import { AbstractAgent, AgentContext, AgentCapability, AgentTool, AgentExecutionResult } from './base/agent.interface.js';
import { invokeLLM } from '../_core/llm.js';
import { logActivity } from '../db.js';

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

  monetization: {
    creator: { price: "$29/mo", fee: "5%" },
    pro: { price: "$79/mo", fee: "3%" },
    enterprise: { price: "$299/mo", fee: "1.5%" },
    agency: { price: "$999/mo", fee: "0%" }
  }
};

export class ExecutiveAgentImpl extends AbstractAgent {
  name = 'ExecutiveAgent';
  capabilities: AgentCapability[] = ['executive', 'sales'];
  version = '2.1.0';

  constructor() {
    super();
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'draft_sales_email',
        description: 'Draft personalized sales emails for prospects',
        execute: (params) => this.draftSalesEmail(params),
        schema: {
          prospect: { type: 'object', description: 'Prospect details' },
        }
      },
      {
        name: 'draft_partnership_email',
        description: 'Draft partnership proposal emails',
        execute: (params) => this.draftPartnershipEmail(params),
        schema: {
          partner: { type: 'object', description: 'Partner details' }
        }
      },
      {
        name: 'generate_linkedin_post',
        description: 'Generate LinkedIn content',
        execute: (params) => this.generateLinkedInPost(params.topic, params.options),
        schema: {
          topic: { type: 'string', description: 'Post topic' },
          options: { type: 'object', description: 'Optional formatting' }
        }
      },
      {
        name: 'generate_blog_post',
        description: 'Generate blog content',
        execute: (params) => this.generateBlogPost(params.topic, params.length, params.keywords),
        schema: {
          topic: { type: 'string' },
          length: { type: 'string', enum: ['short', 'medium', 'long'] },
          keywords: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        name: 'generate_email_campaign',
        description: 'Generate multi-variant email campaigns',
        execute: (params) => this.generateEmailCampaign(params),
        schema: {
          details: { type: 'object', description: 'Campaign details' }
        }
      },
      {
        name: 'daily_briefing',
        description: 'Generate executive daily briefing',
        execute: (params) => this.generateDailyBriefing(params),
        schema: {
          metrics: { type: 'object', description: 'Platform metrics' }
        }
      }
    ];
  }

  async execute(
    action: string,
    params: any,
    context?: AgentContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      let output: any;

      switch (action) {
        case 'draft_sales_email':
          output = await this.draftSalesEmail(params.prospect);
          break;
        case 'draft_partnership_email':
          output = await this.draftPartnershipEmail(params.partner);
          break;
        case 'generate_linkedin_post':
          output = await this.generateLinkedInPost(params.topic, params.options);
          break;
        case 'generate_blog_post':
          output = await this.generateBlogPost(params.topic, params.length, params.keywords);
          break;
        case 'generate_email_campaign':
          output = await this.generateEmailCampaign(params.details);
          break;
        case 'daily_briefing':
          output = await this.generateDailyBriefing(params.metrics);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const executionTimeMs = Date.now() - startTime;

      // Log execution
      await logActivity({
        action: `executive_${action}`,
        entityType: 'agent_execution',
        entityId: context?.missionId || 0,
        details: { params, executionTimeMs }
      });

      return this.createResult(true, output, undefined, [action], executionTimeMs);
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logActivity({
        action: `executive_${action}_failed`,
        entityType: 'agent_execution',
        entityId: context?.missionId || 0,
        details: { error: errorMessage, executionTimeMs }
      });

      return this.createResult(false, undefined, errorMessage, undefined, executionTimeMs);
    }
  }

  async draftSalesEmail(prospect: any): Promise<string> {
    const prompt = `Draft a high-impact sales email for prospect.

Prospect: ${prospect.name} at ${prospect.company}
Industry: ${prospect.industry}
Location: ${prospect.city}

Context:
${JSON.stringify(AUTHICHAIN_CONTEXT, null, 2)}

Requirements:
- Personalize for their industry and location
- Highlight relevant AuthiChain features
- Professional, conversational tone
- Under 150 words
- Include clear CTA`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "text" }
    });

    return response.choices[0].message.content as string;
  }

  async draftPartnershipEmail(partner: any): Promise<string> {
    const prompt = `Draft a partnership proposal email for potential partner.

Partner: ${partner.name}
Company: ${partner.company}
Focus: ${partner.focus}

Context:
${JSON.stringify(AUTHICHAIN_CONTEXT, null, 2)}

Requirements:
- Professional partnership tone
- Emphasize mutual benefits
- Highlight complementary services
- Under 200 words
- Include next steps`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async generateLinkedInPost(topic: string, options?: any): Promise<string> {
    const prompt = `Write an engaging LinkedIn post about: ${topic}
Options: ${JSON.stringify(options ?? {})}
Context: ${JSON.stringify(AUTHICHAIN_CONTEXT)}

Requirements:
- Professional yet conversational
- Include relevant hashtags
- 150-300 words
- Call-to-action or thought-provoking question`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async generateBlogPost(topic: string, length?: string, keywords?: string[]): Promise<string> {
    const prompt = `Write a ${length ?? "medium"}-length blog post about: ${topic}
Keywords: ${(keywords ?? []).join(", ")}
Context: ${JSON.stringify(AUTHICHAIN_CONTEXT)}

Requirements:
- SEO-optimized
- Include relevant AuthiChain use cases
- Clear structure with headings
- Actionable insights
- ${length === 'short' ? '300-500' : length === 'long' ? '1500-2000' : '800-1200'} words`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async generateEmailCampaign(details: any): Promise<string> {
    const prompt = `Generate an email campaign with multiple variants for: ${JSON.stringify(details)}
Context: ${JSON.stringify(AUTHICHAIN_CONTEXT)}

Requirements:
- 3 subject line variants
- 2 email body variants (short & detailed)
- CTA options
- Segment recommendations
- A/B testing suggestions`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async generateDailyBriefing(metrics: any): Promise<string> {
    const prompt = `Generate an executive daily briefing.

Metrics: ${JSON.stringify(metrics)}
Context: ${JSON.stringify(AUTHICHAIN_CONTEXT)}

Structure:
1. **Key Metrics** - Top 3 highlights
2. **Priorities Today** - 3 strategic actions
3. **Opportunities** - 2 emerging opportunities
4. **Risks** - 1-2 risks to monitor
5. **Recommendation** - 1 strategic recommendation`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  // Backward compatibility with existing code
  async draftMarginProtectionEmail(prospect: any): Promise<string> {
    const prompt = `Draft a high-urgency sales email for Michigan Cannabis 24% wholesale tax scenario.

Prospect: ${prospect.name} at ${prospect.company} (${prospect.dba ?? 'N/A'})
Industry: ${prospect.industry}
City: ${prospect.city}

Context:
${JSON.stringify(AUTHICHAIN_CONTEXT, null, 2)}

Requirements:
- Mention specific city and processor/microbusiness status
- Highlight $299 StrainChain BTC Auth product
- Mention ProductDNA visual markers
- Professional, insider tone
- Under 130 words`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async generateLinkedInSurround(lead: any): Promise<string> {
    const prompt = `Generate a concise LinkedIn connection request.

Lead: ${lead.name} at ${lead.company}
Context: They received email about Margin Protection for ${lead.type} in ${lead.city}
Product: StrainChain (Bitcoin Inscribed certificates)

Requirements:
- Tone: Collaborative peer
- Max 300 characters
- Include subtle value prop`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }
}

// Export singleton-like instance for backward compatibility
export const ExecutiveAgent = ExecutiveAgentImpl;
