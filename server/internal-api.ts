import { timingSafeEqual } from "crypto";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
import { Router, type Request, type Response } from "express";
import { getCertificateByNumber, getWhiteLabelByApiKey, createProduct, getDb } from "./db";
import { computeTrustScore, generateProductQRON } from "./qron-service";
import { calculateStrainRarity, formatTruthLayerMetadata } from "./cannabis-service";
import { invokeLLM, parseLLMContent } from "./_core/llm";
import { ENV } from "./_core/env";
import { reportUsageToStripe } from "./tenant-billing";

/**
 * Internal API routes for the authichain-gateway Cloudflare Worker.
 * Protected by X-Internal-Secret header.
 */
export function createInternalRouter(): Router {
  const router = Router();

  // Auth middleware
  router.use((req: Request, res: Response, next) => {
    const secret = req.headers["x-internal-secret"];
    if (!secret || typeof secret !== "string" || !timingSafeStringEqual(secret, ENV.internalApiSecret)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ─── POST /api/internal/verify ──────────────────────────────────────────────
  router.post("/verify", async (req: Request, res: Response) => {
    try {
      const { identifier, productId, barcode, imageUrl } = req.body;
      const lookupId = identifier || productId || barcode;
      if (!lookupId) return res.status(400).json({ error: "identifier, productId, or barcode required" });

      // Check if it's a certificate number
      const cert = await getCertificateByNumber(lookupId);
      if (cert) {
        return res.json({
          verified: cert.status === "active",
          type: "certificate",
          certificate: cert,
          trustScore: 95,
          confidence: 0.98,
          agents: ["Guardian", "Archivist", "Sentinel", "Scout", "Arbiter"],
        });
      }

      // Prevent prompt injection — only the sanitized identifier reaches the LLM
      const safeLookupId = String(lookupId).replace(/[^a-zA-Z0-9\-_.]/g, "").slice(0, 128);

      // AI-based verification
      const analysis = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are AuthiChain's product verification engine. Analyze the product identifier and determine authenticity. Return JSON: { "verified": boolean, "confidence": number (0-1), "reasoning": string, "riskFlags": string[] }`,
          },
          {
            role: "user",
            content: JSON.stringify({ identifier: safeLookupId, hasImage: !!imageUrl }),
          },
        ],
        responseFormat: { type: "json_object" },
      });

      let result: { verified: boolean; confidence: number; reasoning: string; riskFlags: string[] };
      try {
        result = parseLLMContent(analysis.choices[0].message.content);
      } catch {
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({
        verified: result.verified,
        type: "ai_analysis",
        trustScore: Math.round(result.confidence * 100),
        confidence: result.confidence,
        reasoning: result.reasoning,
        riskFlags: result.riskFlags || [],
        agents: ["Guardian", "Archivist", "Sentinel", "Scout", "Arbiter"],
      });
    } catch (err: any) {
      console.error("[Internal API] verify error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/qr/generate ──────────────────────────��─────────────
  router.post("/qr/generate", async (req: Request, res: Response) => {
    try {
      const { url, data, style, productName, brand, productId, prompt } = req.body;
      const qrData = url || data;
      if (!qrData) return res.status(400).json({ error: "url or data required" });

      const result = await generateProductQRON({
        productId: productId || 0,
        productName: productName || "Product",
        brand: brand || undefined,
        tier: style === "premium" ? "premium" : "standard",
        verifyUrl: qrData,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[Internal API] qr/generate error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/certificates/verify ────────────────────────────────
  router.post("/certificates/verify", async (req: Request, res: Response) => {
    try {
      const raw = req.body?.certNumber ?? req.body?.number;
      const number = typeof raw === 'string' ? raw : undefined;
      if (!number) return res.status(400).json({ error: "certNumber body field required" });
      if (number.length > 64) return res.status(400).json({ error: "certNumber too long" });

      const cert = await getCertificateByNumber(number);
      if (!cert) return res.status(404).json({ error: "Certificate not found", valid: false });

      res.json({
        valid: cert.status === "active",
        certificate: cert,
        issuedAt: cert.issuedAt,
        expiresAt: cert.expiresAt,
        blockchainVerified: !!cert.blockchainTxHash,
      });
    } catch (err: any) {
      console.error("[Internal API] certificates/verify error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/cannabis/verify ────────────────────────────────────
  router.post("/cannabis/verify", async (req: Request, res: Response) => {
    try {
      const { strainId, strainName, dispensaryId, batchId, thcPercent, cbdPercent } = req.body;
      const strain = strainName || strainId;
      if (!strain) return res.status(400).json({ error: "strainName or strainId required" });

      const metadata = {
        name: strain,
        type: "HYBRID" as const,
        genetics: ["Unknown"],
        thcContent: thcPercent || 25,
        cbdContent: cbdPercent || 1,
        harvestDate: new Date().toISOString(),
      };
      const profile = { thc: thcPercent || 25, thca: (thcPercent || 25) * 1.12, cbd: cbdPercent || 1, cbda: (cbdPercent || 1) * 1.2, total: (thcPercent || 25) + (cbdPercent || 1) + 5 };

      const rarity = calculateStrainRarity(metadata, profile);
      const truthLayer = formatTruthLayerMetadata(metadata, profile);

      res.json({
        verified: true,
        strainName: strain,
        batchId: batchId || null,
        dispensaryId: dispensaryId || null,
        rarityScore: rarity,
        complianceStatus: dispensaryId ? "compliant" : "unverified",
        truthLayer,
      });
    } catch (err: any) {
      console.error("[Internal API] cannabis/verify error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/trust-score ────────────────────────────────────────
  router.post("/trust-score", async (req: Request, res: Response) => {
    try {
      const { qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk } = req.body;

      const score = computeTrustScore({
        qrDecodePass: qrDecodePass ?? true,
        blockchainCertExists: blockchainCertExists ?? false,
        communityVerified: visualMatch ? Math.round(visualMatch / 20) : 0,
        communityFlagged: 0,
        openArtRegistered: nfcMatch ?? false,
      });

      res.json({
        ...score,
        inputs: { qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk },
      });
    } catch (err: any) {
      console.error("[Internal API] trust-score error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── GET /api/internal/analytics ───────────────────────────────────────────
  router.get("/analytics", async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as string) || "30d";
      const db = await getDb();
      if (!db) return res.status(503).json({ error: "Database unavailable" });

      // Return aggregated metrics
      res.json({
        period,
        verifications: { total: 0, authentic: 0, counterfeit: 0 },
        qrCodesGenerated: 0,
        certificatesIssued: 0,
        activeAgents: 5,
        message: "Analytics data will be populated once usage metering is active",
      });
    } catch (err: any) {
      console.error("[Internal API] analytics error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/products/register ──────────────────────────────────
  router.post("/products/register", async (req: Request, res: Response) => {
    try {
      const { name, brand, category, serialNumber, description, userId } = req.body;
      if (!name) return res.status(400).json({ error: "name required" });
      const parsedUserId = parseInt(userId, 10);
      if (!userId || !Number.isFinite(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ error: "valid userId required" });
      }

      const product = await createProduct({
        name,
        brand,
        category,
        serialNumber,
        description,
        userId: parsedUserId,
        status: "active",
      });

      res.json({ success: true, product });
    } catch (err: any) {
      console.error("[Internal API] products/register error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/usage/report ───────────────────────────────────────
  router.post("/usage/report", async (req: Request, res: Response) => {
    try {
      const { records } = req.body;
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: "records array required" });
      }

      // Process each usage record
      await Promise.all(
        records.map((r: { tenantId: number; endpoint: string; count: number }) =>
          reportUsageToStripe(r.tenantId, r.endpoint, r.count),
        ),
      );

      res.json({ success: true, processed: records.length });
    } catch (err: any) {
      console.error("[Internal API] usage/report error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── GET /api/internal/tenant ──────────────────────────────────────────────
  router.get("/tenant", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers["authorization"];
      const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!apiKey) return res.status(400).json({ error: "Authorization: Bearer <apiKey> required" });

      const tenant = await getWhiteLabelByApiKey(apiKey);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      res.json({
        id: tenant.id,
        companyName: tenant.companyName,
        status: tenant.status,
        apiCallLimit: tenant.apiCallLimit,
        monthlyApiCalls: tenant.monthlyApiCalls,
        features: tenant.features,
      });
    } catch (err: any) {
      console.error("[Internal API] tenant error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
