import "dotenv/config";
import { pathToFileURL } from "node:url";
import { invokeLLM } from "../_core/llm";
import { logActivity } from "../db";

type OrganicContentPlanItem = {
  segment: string;
  channel: "blog" | "email" | "linkedin";
  topic: string;
  title: string;
  slug: string;
  keywords: string[];
  cta: string;
  publishWindowDays: number;
};

const DEFAULT_TOPICS: Array<{ segment: string; topics: string[] }> = [
  {
    segment: "restaurants",
    topics: [
      "QR-driven table conversion optimization",
      "Menu scan-to-order attribution setup",
      "Reducing no-show risk with demo-ready QR flows",
    ],
  },
  {
    segment: "events",
    topics: [
      "Venue QR funnels from scan to paid access",
      "Sponsor ROI reporting with location-level scans",
      "Launch-week checklist for event conversion flows",
    ],
  },
  {
    segment: "ecommerce",
    topics: [
      "Scan-to-checkout attribution for product packaging",
      "Recovering abandoned checkout after QR intent",
      "Retention loops after first scan conversion",
    ],
  },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildFallbackPlan(): OrganicContentPlanItem[] {
  const output: OrganicContentPlanItem[] = [];
  for (const bucket of DEFAULT_TOPICS) {
    for (const topic of bucket.topics) {
      output.push({
        segment: bucket.segment,
        channel: "blog",
        topic,
        title: `AuthiChain Guide: ${topic}`,
        slug: slugify(`${bucket.segment}-${topic}`),
        keywords: ["qr conversion", bucket.segment, "attribution", "checkout automation"],
        cta: "Book a demo",
        publishWindowDays: 7,
      });
    }
  }
  return output;
}

async function buildLlmPlan(): Promise<OrganicContentPlanItem[]> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a B2B growth lead for AuthiChain. Generate practical organic traffic content plan items that map to lead capture, qualification, outreach, and checkout.",
      },
      {
        role: "user",
        content:
          "Return 9 items (3 each for restaurants/events/ecommerce). Include channel, topic, title, slug, keywords, CTA, and publish window days.",
      },
    ],
    outputSchema: {
      name: "organic_content_plan",
      strict: true,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                segment: { type: "string" },
                channel: { type: "string", enum: ["blog", "email", "linkedin"] },
                topic: { type: "string" },
                title: { type: "string" },
                slug: { type: "string" },
                keywords: { type: "array", items: { type: "string" } },
                cta: { type: "string" },
                publishWindowDays: { type: "integer" },
              },
              required: [
                "segment",
                "channel",
                "topic",
                "title",
                "slug",
                "keywords",
                "cta",
                "publishWindowDays",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content as string);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items.map((item: any) => ({
    segment: String(item.segment || "unknown"),
    channel: item.channel === "email" || item.channel === "linkedin" ? item.channel : "blog",
    topic: String(item.topic || "Untitled"),
    title: String(item.title || "Untitled"),
    slug: slugify(String(item.slug || item.title || item.topic || "untitled")),
    keywords: Array.isArray(item.keywords) ? item.keywords.map((x: unknown) => String(x)) : [],
    cta: String(item.cta || "Book a demo"),
    publishWindowDays: Number.isFinite(Number(item.publishWindowDays))
      ? Math.max(1, Math.min(30, Number(item.publishWindowDays)))
      : 7,
  }));
}

async function emitAnalyticsEvents(itemCount: number) {
  const posthogKey = process.env.POSTHOG_PROJECT_KEY || process.env.VITE_POSTHOG_KEY || "";
  const posthogHost = (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
  if (posthogKey) {
    await fetch(`${posthogHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event: "organic_content_plan_generated",
        distinct_id: "agentz-organic",
        properties: { source: "authichain-unified", itemCount },
      }),
    }).catch(() => null);
  }

  const measurementId = process.env.GA4_MEASUREMENT_ID || "";
  const apiSecret = process.env.GA4_API_SECRET || "";
  if (measurementId && apiSecret) {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "agentz.1",
        events: [{ name: "organic_content_plan_generated", params: { item_count: itemCount } }],
      }),
    }).catch(() => null);
  }
}

export async function runOrganicTrafficAutomation() {
  let items = buildFallbackPlan();
  let generatedBy = "template";

  if (process.env.BUILT_IN_FORGE_API_KEY) {
    try {
      const llmItems = await buildLlmPlan();
      if (llmItems.length > 0) {
        items = llmItems;
        generatedBy = "llm";
      }
    } catch {
      // Fallback to deterministic template plan.
    }
  }

  await emitAnalyticsEvents(items.length);
  const payload = {
    generatedAt: new Date().toISOString(),
    generatedBy,
    itemCount: items.length,
    items,
  };

  await logActivity({
    userId: null,
    action: "organic_content_plan_generated",
    entityType: "marketing",
    entityId: 0,
    details: payload,
  });

  return payload;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runOrganicTrafficAutomation()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error("Organic traffic automation failed:", err);
      process.exit(1);
    });
}
