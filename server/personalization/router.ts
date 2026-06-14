import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { visitorProfiles, personalizationRules, personalizationEvents } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  generatePersonalizedContent,
  generatePersonalizationRules,
  detectSegment,
  matchRules,
  getGeolocation,
  parseUTMParams,
  detectTrafficSource,
  analyzePersonalizationPerformance,
} from "./contentEngine";

export const personalizationRouter = router({
  // Track visitor and get personalized content (public endpoint)
  getPersonalizedContent: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      ipAddress: z.string().optional(),
      referrer: z.string().optional(),
      userAgent: z.string().optional(),
      url: z.string().optional(),
      targetElement: z.string().optional().default("headline"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Check if visitor profile exists
      let profile = (await db
        .select()
        .from(visitorProfiles)
        .where(eq(visitorProfiles.sessionId, input.sessionId))
        .limit(1))[0];

      if (!profile) {
        // Create new visitor profile
        const geo = input.ipAddress ? await getGeolocation(input.ipAddress) : {};
        const utmParams = input.url ? parseUTMParams(input.url) : {};
        const trafficSource = detectTrafficSource(input.referrer);
        
        // Detect device type from user agent
        let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
        if (input.userAgent) {
          if (/mobile/i.test(input.userAgent)) deviceType = "mobile";
          else if (/tablet|ipad/i.test(input.userAgent)) deviceType = "tablet";
        }

        const segment = detectSegment({
          country: geo.country,
          trafficSource,
          deviceType,
          utmCampaign: utmParams.utmCampaign,
        });

        await db.insert(visitorProfiles).values({
          sessionId: input.sessionId,
          ipAddress: input.ipAddress,
          country: geo.country,
          city: geo.city,
          region: geo.region,
          trafficSource,
          referrer: input.referrer,
          utmSource: utmParams.utmSource,
          utmMedium: utmParams.utmMedium,
          utmCampaign: utmParams.utmCampaign,
          deviceType,
          segment,
          pageViews: 1,
        });

        profile = (await db
          .select()
          .from(visitorProfiles)
          .where(eq(visitorProfiles.sessionId, input.sessionId))
          .limit(1))[0];
      } else {
        // Update existing profile
        await db
          .update(visitorProfiles)
          .set({
            pageViews: profile.pageViews + 1,
            lastSeen: new Date(),
          })
          .where(eq(visitorProfiles.id, profile.id));
      }

      // Get active personalization rules for this element
      const rules = await db
        .select()
        .from(personalizationRules)
        .where(
          and(
            eq(personalizationRules.status, "active"),
            eq(personalizationRules.targetElement, input.targetElement)
          )
        );

      // Match visitor to rules
      const matchedRule = matchRules(
        {
          country: profile.country || undefined,
          city: profile.city || undefined,
          trafficSource: profile.trafficSource || undefined,
          utmSource: profile.utmSource || undefined,
          utmMedium: profile.utmMedium || undefined,
          utmCampaign: profile.utmCampaign || undefined,
          deviceType: (profile.deviceType as "desktop" | "mobile" | "tablet" | null) || undefined,
          segment: profile.segment || undefined,
        },
        rules.map(r => ({
          id: r.id,
          conditions: typeof r.conditions === "string" ? r.conditions : JSON.stringify(r.conditions ?? {}),
          content: r.content,
          priority: r.priority,
        }))
      );

      if (matchedRule) {
        // Track view event
        await db.insert(personalizationEvents).values({
          ruleId: matchedRule.id,
          sessionId: input.sessionId,
          eventType: "view",
        });

        // Update rule stats
        const rule = rules.find(r => r.id === matchedRule.id);
        if (rule) {
          await db
            .update(personalizationRules)
            .set({
              views: rule.views + 1,
            })
            .where(eq(personalizationRules.id, matchedRule.id));

          // Recalculate conversion rate
          const newRate = rule.views > 0 ? Math.round((rule.conversions / rule.views) * 10000) / 100 : 0;
          await db
            .update(personalizationRules)
            .set({
              conversionRate: newRate,
            })
            .where(eq(personalizationRules.id, matchedRule.id));
        }

        return {
          content: matchedRule.content,
          ruleId: matchedRule.id,
          segment: profile.segment,
        };
      }

      return null;
    }),

  // Track conversion (public endpoint)
  trackConversion: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      ruleId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      // Update visitor profile
      await db
        .update(visitorProfiles)
        .set({
          converted: 1,
        })
        .where(eq(visitorProfiles.sessionId, input.sessionId));

      // If ruleId provided, track conversion for that rule
      if (input.ruleId) {
        await db.insert(personalizationEvents).values({
          ruleId: input.ruleId,
          sessionId: input.sessionId,
          eventType: "conversion",
        });

        // Update rule stats
        const rule = (await db
          .select()
          .from(personalizationRules)
          .where(eq(personalizationRules.id, input.ruleId))
          .limit(1))[0];

        if (rule) {
          await db
            .update(personalizationRules)
            .set({
              conversions: rule.conversions + 1,
            })
            .where(eq(personalizationRules.id, input.ruleId));

          // Recalculate conversion rate
          const newRate = rule.views > 0 ? Math.round((rule.conversions / rule.views) * 10000) / 100 : 0;
          await db
            .update(personalizationRules)
            .set({
              conversionRate: newRate,
            })
            .where(eq(personalizationRules.id, input.ruleId));
        }
      }

      return { success: true };
    }),

  // Create personalization rule
  createRule: protectedProcedure
    .input(z.object({
      name: z.string(),
      description: z.string().optional(),
      targetElement: z.string(),
      conditions: z.record(z.string(), z.any()),
      content: z.string(),
      priority: z.number().optional().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db.insert(personalizationRules).values({
        name: input.name,
        description: input.description,
        targetElement: input.targetElement,
        conditions: JSON.stringify(input.conditions),
        content: input.content,
        priority: input.priority,
        status: "draft",
        aiGenerated: 0,
        createdBy: ctx.user.id,
      });

      return { success: true };
    }),

  // Generate personalization rules using AI
  generateRules: protectedProcedure
    .input(z.object({
      targetElement: z.string(),
      baseContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Generate rules using AI
      const rules = await generatePersonalizationRules(
        input.targetElement,
        input.baseContent
      );

      // Insert rules
      for (const rule of rules) {
        await db.insert(personalizationRules).values({
          name: rule.name,
          targetElement: input.targetElement,
          conditions: JSON.stringify(rule.conditions),
          content: rule.content,
          priority: 0,
          status: "draft",
          aiGenerated: 1,
          createdBy: ctx.user.id,
        });
      }

      return { rulesGenerated: rules.length };
    }),

  // List all rules
  listRules: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "paused", "draft"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let query = db.select().from(personalizationRules).orderBy(desc(personalizationRules.createdAt)) as any;

      if (input?.status) {
        query = query.where(eq(personalizationRules.status, input.status)) as any;
      }

      return await query;
    }),

  // Get rule details
  getRule: protectedProcedure
    .input(z.object({
      ruleId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const rules = await db
        .select()
        .from(personalizationRules)
        .where(eq(personalizationRules.id, input.ruleId))
        .limit(1);

      return rules[0] || null;
    }),

  // Activate rule
  activateRule: protectedProcedure
    .input(z.object({
      ruleId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(personalizationRules)
        .set({
          status: "active",
        })
        .where(eq(personalizationRules.id, input.ruleId));

      return { success: true };
    }),

  // Pause rule
  pauseRule: protectedProcedure
    .input(z.object({
      ruleId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      await db
        .update(personalizationRules)
        .set({
          status: "paused",
        })
        .where(eq(personalizationRules.id, input.ruleId));

      return { success: true };
    }),

  // Get visitor segments analytics
  getSegmentAnalytics: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];

      const profiles = await db.select().from(visitorProfiles);

      // Group by segment
      const segmentStats = profiles.reduce((acc, profile) => {
        const segment = profile.segment || "unknown";
        if (!acc[segment]) {
          acc[segment] = {
            segment,
            visitors: 0,
            conversions: 0,
            conversionRate: 0,
            avgTimeOnSite: 0,
            avgPageViews: 0,
          };
        }

        acc[segment].visitors += 1;
        acc[segment].conversions += profile.converted;
        acc[segment].avgTimeOnSite += profile.timeOnSite;
        acc[segment].avgPageViews += profile.pageViews;

        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      Object.values(segmentStats).forEach((stats: any) => {
        stats.conversionRate = (stats.conversions / stats.visitors) * 100;
        stats.avgTimeOnSite = Math.round(stats.avgTimeOnSite / stats.visitors);
        stats.avgPageViews = Math.round((stats.avgPageViews / stats.visitors) * 10) / 10;
      });

      return Object.values(segmentStats);
    }),

  // Get personalization performance analytics
  getPerformanceAnalytics: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return null;

      const rules = await db
        .select()
        .from(personalizationRules)
        .where(eq(personalizationRules.status, "active"));

      if (rules.length === 0) return null;

      const analysis = await analyzePersonalizationPerformance(
        rules.map(r => ({
          name: r.name,
          conditions: typeof r.conditions === "string" ? r.conditions : JSON.stringify(r.conditions ?? {}),
          views: r.views,
          conversions: r.conversions,
          conversionRate: r.conversionRate,
        }))
      );

      return {
        totalRules: rules.length,
        totalViews: rules.reduce((sum, r) => sum + r.views, 0),
        totalConversions: rules.reduce((sum, r) => sum + r.conversions, 0),
        avgConversionRate: rules.reduce((sum, r) => sum + r.conversionRate, 0) / rules.length,
        topPerformers: analysis.topPerformers,
        insights: analysis.insights,
        recommendations: analysis.recommendations,
      };
    }),
});
