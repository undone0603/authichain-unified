import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { serviceOrders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "../_core/env";

const SERVICE_CATALOG = [
  {
    key: "authenticity_audit",
    icon: "Shield",
    name: "Authenticity Intelligence Audit",
    tagline: "Know your supply chain vulnerabilities before counterfeiters do.",
    description: "A comprehensive 48-hour analysis of your brand's authentication exposure, counterfeit risk score, and a prioritized remediation roadmap.",
    displayPrice: "$2,499",
    price: 249900,
    featured: true,
    deliverables: [
      "Full brand exposure report",
      "Counterfeit risk heatmap",
      "QR authentication vulnerability audit",
      "Remediation roadmap with ROI projections",
    ],
    deliveryTime: "5–7 business days",
  },
  {
    key: "cinematic_page",
    icon: "Film",
    name: "QRON Cinematic Product Page",
    tagline: "Turn every scan into a story that sells.",
    description: "A branded, animated product authentication page that wows your customers and builds trust on every scan. Hosted on the AuthiChain CDN.",
    displayPrice: "$999",
    price: 99900,
    featured: false,
    deliverables: [
      "Custom animated scan-landing page",
      "Brand color + logo integration",
      "Mobile-optimized WebXR experience",
      "Permanent hosting on AuthiChain CDN",
    ],
    deliveryTime: "3–5 business days",
  },
  {
    key: "automation_setup",
    icon: "Bot",
    name: "AI Automation Setup",
    tagline: "Deploy your autonomous authentication pipeline in days, not months.",
    description: "Full AgentZ pipeline configuration: lead-finder, outreach sequences, CRM sync, and the Bayesian tone engine — all tuned for your vertical.",
    displayPrice: "$4,999",
    price: 499900,
    featured: false,
    deliverables: [
      "Autonomous outreach pipeline (3-email sequence)",
      "CRM sync configuration (HubSpot/Salesforce)",
      "Bayesian tone calibration for your vertical",
      "30-day performance monitoring",
    ],
    deliveryTime: "7–10 business days",
  },
  {
    key: "landing_page",
    icon: "Globe",
    name: "Authenticity Landing Page",
    tagline: "A high-converting landing page purpose-built for trust.",
    description: "A custom marketing landing page showcasing your authentication story — complete with scan demos, trust badges, and conversion-optimized copy.",
    displayPrice: "$1,499",
    price: 149900,
    featured: false,
    deliverables: [
      "Custom landing page (up to 5 sections)",
      "Scan demo integration",
      "SEO meta tags + schema markup",
      "1 revision round included",
    ],
    deliveryTime: "5–7 business days",
  },
  {
    key: "brand_story_pack",
    icon: "BookOpen",
    name: "Brand Story Intelligence Pack",
    tagline: "Your provenance narrative, ready for press and investors.",
    description: "A complete content kit: brand story document, investor-ready one-pager, press release template, and LinkedIn thought-leadership series.",
    displayPrice: "$1,999",
    price: 199900,
    featured: false,
    deliverables: [
      "Brand story document (2,000 words)",
      "Investor one-pager (PDF)",
      "Press release template",
      "5-part LinkedIn content series",
    ],
    deliveryTime: "7 business days",
  },
  {
    key: "government_dossier",
    icon: "Building2",
    name: "Government-Ready Intelligence Dossier",
    tagline: "Win RFPs with a compliance-ready authentication brief.",
    description: "A tailored procurement dossier aligned to your target government agency's procurement language, compliance frameworks, and decision criteria.",
    displayPrice: "$7,499",
    price: 749900,
    featured: false,
    deliverables: [
      "Agency-specific compliance mapping",
      "Technical architecture brief",
      "ROI model for procurement committee",
      "Draft RFP response template",
      "60-minute strategy call",
    ],
    deliveryTime: "10–14 business days",
  },
];

export const servicesRouter = router({
  catalog: publicProcedure.query(async () => {
    return SERVICE_CATALOG;
  }),

  checkout: protectedProcedure.input(z.object({
    serviceType: z.string(),
    businessName: z.string().optional(),
    businessType: z.string().optional(),
    businessUrl: z.string().optional(),
    notes: z.string().optional(),
    origin: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const service = SERVICE_CATALOG.find(s => s.key === input.serviceType);
    if (!service) throw new Error("Unknown service type");

    const db = await getDb();
    const [order] = await db.insert(serviceOrders).values({
      userId: ctx.user.id,
      serviceType: input.serviceType,
      status: "pending",
      details: {
        businessName: input.businessName,
        businessType: input.businessType,
        businessUrl: input.businessUrl,
        notes: input.notes,
        price: service.price,
        name: service.name,
      },
    }).returning();

    const origin = input.origin ?? "https://authichain.com";
    const checkoutUrl = `${origin}/services/orders?orderId=${order.id}&service=${input.serviceType}`;

    return { orderId: order.id, checkoutUrl, service };
  }),

  myOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    return db.select().from(serviceOrders).where(eq(serviceOrders.userId, ctx.user.id));
  }),
});
