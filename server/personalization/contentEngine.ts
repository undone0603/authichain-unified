import { invokeLLM } from "../_core/llm";

/**
 * AI Content Personalization Engine
 * 
 * Automatically generates personalized content based on visitor segments
 */

export interface VisitorContext {
  country?: string;
  city?: string;
  trafficSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  language?: string;
  segment?: string;
}

export interface PersonalizedContent {
  headline: string;
  subheadline: string;
  cta: string;
  heroText: string;
  reasoning: string;
  confidence: number;
}

/**
 * Generate personalized landing page content for visitor segment
 */
export async function generatePersonalizedContent(
  context: VisitorContext,
  baseContent: {
    headline: string;
    subheadline: string;
    cta: string;
  }
): Promise<PersonalizedContent> {
  const prompt = `You are an expert conversion copywriter personalizing landing page content for AuthiChain, an AI-powered blockchain authentication platform.

**Visitor Context:**
${context.country ? `- Location: ${context.city || ''} ${context.country}` : ''}
${context.trafficSource ? `- Traffic Source: ${context.trafficSource}` : ''}
${context.utmSource ? `- UTM Source: ${context.utmSource}` : ''}
${context.utmMedium ? `- UTM Medium: ${context.utmMedium}` : ''}
${context.utmCampaign ? `- Campaign: ${context.utmCampaign}` : ''}
${context.deviceType ? `- Device: ${context.deviceType}` : ''}
${context.segment ? `- Segment: ${context.segment}` : ''}

**Base Content:**
- Headline: ${baseContent.headline}
- Subheadline: ${baseContent.subheadline}
- CTA: ${baseContent.cta}

**Task:**
Personalize this content to maximize relevance and conversion for this specific visitor. Consider:

1. **Geographic Personalization:** Reference local market needs, regulations, or examples
2. **Traffic Source Personalization:** Match messaging to visitor intent (e.g., Google search vs. social media)
3. **Device Personalization:** Optimize for mobile vs. desktop experience
4. **Campaign Personalization:** Align with campaign messaging

**Guidelines:**
- Keep core value proposition intact
- Make changes meaningful, not superficial
- Use local examples when relevant
- Match tone to traffic source
- Maintain brand voice
- Keep mobile-friendly (short, punchy)

Return personalized headline, subheadline, CTA, hero text, reasoning, and confidence (0-100).`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert conversion copywriter who creates highly personalized content that resonates with specific audience segments.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "personalized_content",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            subheadline: { type: "string" },
            cta: { type: "string" },
            heroText: { type: "string" },
            reasoning: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["headline", "subheadline", "cta", "heroText", "reasoning", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
}

/**
 * Generate personalization rules for common segments
 */
export async function generatePersonalizationRules(
  targetElement: string,
  baseContent: string
): Promise<Array<{
  name: string;
  conditions: Record<string, any>;
  content: string;
  reasoning: string;
  expectedLift: number;
}>> {
  const prompt = `Generate personalization rules for AuthiChain landing page.

**Element:** ${targetElement}
**Base Content:** ${baseContent}

**Task:**
Create 5-7 personalization rules for different visitor segments. For each rule:

1. **Name:** Descriptive name (e.g., "Mobile Users from Google Ads")
2. **Conditions:** JSON object with targeting criteria
3. **Content:** Personalized version of the content
4. **Reasoning:** Why this personalization works for this segment
5. **Expected Lift:** Estimated conversion improvement (0-100%)

**Common Segments:**
- Geographic (US, Europe, Asia)
- Traffic Source (Google, LinkedIn, Direct)
- Device Type (Mobile, Desktop)
- Campaign Type (Brand, Product, Industry)
- Referrer (Partner sites, social media)

**Example Conditions:**
\`\`\`json
{
  "country": "US",
  "trafficSource": "google",
  "deviceType": "mobile"
}
\`\`\`

Return array of personalization rules.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert in audience segmentation and personalized marketing.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "personalization_rules",
        strict: true,
        schema: {
          type: "object",
          properties: {
            rules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  conditions: { type: "object", additionalProperties: true },
                  content: { type: "string" },
                  reasoning: { type: "string" },
                  expectedLift: { type: "number" },
                },
                required: ["name", "conditions", "content", "reasoning", "expectedLift"],
                additionalProperties: false,
              },
            },
          },
          required: ["rules"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const result = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
  return result.rules;
}

/**
 * Detect visitor segment based on context
 */
export function detectSegment(context: VisitorContext): string {
  const segments: string[] = [];

  // Geographic segments
  if (context.country === "US") segments.push("us");
  else if (["GB", "DE", "FR", "IT", "ES"].includes(context.country || "")) segments.push("europe");
  else if (["CN", "JP", "KR", "SG"].includes(context.country || "")) segments.push("asia");

  // Traffic source segments
  if (context.trafficSource?.includes("google")) segments.push("search");
  else if (context.trafficSource?.includes("linkedin")) segments.push("linkedin");
  else if (context.trafficSource?.includes("facebook") || context.trafficSource?.includes("twitter")) segments.push("social");
  else if (!context.trafficSource || context.trafficSource === "direct") segments.push("direct");

  // Device segments
  if (context.deviceType === "mobile") segments.push("mobile");
  else if (context.deviceType === "desktop") segments.push("desktop");

  // Campaign segments
  if (context.utmCampaign?.includes("brand")) segments.push("brand_aware");
  else if (context.utmCampaign?.includes("product")) segments.push("product_interest");
  else if (context.utmCampaign?.includes("retarget")) segments.push("retargeting");

  return segments.join("_") || "default";
}

/**
 * Match visitor to personalization rules
 */
export function matchRules(
  context: VisitorContext,
  rules: Array<{
    id: number;
    conditions: string;
    content: string;
    priority: number;
  }>
): { id: number; content: string } | null {
  // Sort by priority (higher first)
  const sortedRules = rules.sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    try {
      const conditions = JSON.parse(rule.conditions);
      
      // Check if all conditions match
      let matches = true;
      for (const [key, value] of Object.entries(conditions)) {
        const contextValue = (context as any)[key];
        
        if (Array.isArray(value)) {
          // Array means "any of these values"
          if (!value.includes(contextValue)) {
            matches = false;
            break;
          }
        } else if (typeof value === "object" && value !== null) {
          // Object with operators
          const valueObj = value as any;
          if (valueObj.contains && !contextValue?.includes(valueObj.contains)) {
            matches = false;
            break;
          }
          if (valueObj.equals && contextValue !== valueObj.equals) {
            matches = false;
            break;
          }
        } else {
          // Direct equality
          if (contextValue !== value) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        return { id: rule.id, content: rule.content };
      }
    } catch (error) {
      console.error(`Error matching rule ${rule.id}:`, error);
      continue;
    }
  }

  return null;
}

/**
 * Get geolocation from IP address
 */
export async function getGeolocation(ipAddress: string): Promise<{
  country?: string;
  city?: string;
  region?: string;
}> {
  try {
    // Use ipapi.co for geolocation (free tier: 1000 requests/day)
    const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
    const data = await response.json();
    
    return {
      country: data.country_code,
      city: data.city,
      region: data.region,
    };
  } catch (error) {
    console.error("Geolocation error:", error);
    return {};
  }
}

/**
 * Parse UTM parameters from URL
 */
export function parseUTMParams(url: string): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  try {
    const urlObj = new URL(url);
    return {
      utmSource: urlObj.searchParams.get("utm_source") || undefined,
      utmMedium: urlObj.searchParams.get("utm_medium") || undefined,
      utmCampaign: urlObj.searchParams.get("utm_campaign") || undefined,
    };
  } catch (error) {
    return {};
  }
}

/**
 * Detect traffic source from referrer
 */
export function detectTrafficSource(referrer?: string): string {
  if (!referrer) return "direct";
  
  const lowerReferrer = referrer.toLowerCase();
  
  if (lowerReferrer.includes("google")) return "google";
  if (lowerReferrer.includes("bing")) return "bing";
  if (lowerReferrer.includes("linkedin")) return "linkedin";
  if (lowerReferrer.includes("facebook")) return "facebook";
  if (lowerReferrer.includes("twitter") || lowerReferrer.includes("t.co")) return "twitter";
  if (lowerReferrer.includes("reddit")) return "reddit";
  
  return "referral";
}

/**
 * Analyze personalization performance
 */
export async function analyzePersonalizationPerformance(
  rules: Array<{
    name: string;
    conditions: string;
    views: number;
    conversions: number;
    conversionRate: number;
  }>
): Promise<{
  insights: string[];
  recommendations: string[];
  topPerformers: string[];
}> {
  const prompt = `Analyze personalization performance and provide insights:

**Rules Performance:**
${rules.map(r => `
- **${r.name}**
  - Conditions: ${r.conditions}
  - Views: ${r.views}
  - Conversions: ${r.conversions}
  - Conversion Rate: ${r.conversionRate}%
`).join('\n')}

**Task:**
1. Identify which segments respond best to personalization
2. Find patterns in high-performing rules
3. Recommend new segments to target
4. Suggest improvements for low-performing rules

Provide actionable insights for optimization.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an expert data analyst specializing in personalization and conversion optimization.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "performance_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: { type: "string" },
            },
            recommendations: {
              type: "array",
              items: { type: "string" },
            },
            topPerformers: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["insights", "recommendations", "topPerformers"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
}
