import { registryLookupDecision } from "../packages/verifier/src/registry-decision";
import { timingSafeEqual } from "crypto";
import { Router, type Request, type Response } from "express";
import { ENV } from "./_core/env";
import { calculateStrainRarity, formatTruthLayerMetadata } from "./cannabis-service";
import { createProduct, getCertificateByNumber, getDb, getWhiteLabelByApiKey } from "./db";
import { computeTrustScore, generateProductQRON } from "./qron-service";
import { reportUsageToStripe } from "./tenant-billing";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unknown error";
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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
      const { identifier, productId, barcode } = req.body;
      const lookupId = identifier || productId || barcode;
      if (!lookupId) return res.status(400).json({ error: "identifier, productId, or barcode required" });

      // No LLM guess, no fixed trust score, no agent claims: an unknown
      // identifier is not_found and a known one is a registry record only.
      const cert = await getCertificateByNumber(String(lookupId));
      const decision = registryLookupDecision(cert ?? null);
      res.json({
        verified: decision.valid,
        type: cert ? "certificate" : "not_found",
        ...(cert ? { certificate: cert } : {}),
        trustScore: null,
        ...decision,
      });
    } catch (err: unknown) {
      console.error("[Internal API] verify error:", getErrorMessage(err));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/qr/generate ──────────────────────────��─────────────
  router.post("/qr/generate", async (req: Request, res: Response) => {
    try {
      const { url, data, style, productName, brand, productId, _unused_prompt_95 } = req.body;
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
    } catch (err: unknown) {
      console.error("[Internal API] qr/generate error:", getErrorMessage(err));
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
    } catch (err: unknown) {
      console.error("[Internal API] certificates/verify error:", getErrorMessage(err));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/cannabis/verify ────────────────────────────────────
  router.post("/cannabis/verify", async (req: Request, res: Response) => {
    try {
      const { strainId, strainName, dispensaryId, batchId, thcPercent, cbdPercent } = req.body;
      const strain = strainName || strainId;
      if (!strain) return res.status(400).json({ error: "strainName or strainId required" });

      const thc = typeof thcPercent === "number" ? thcPercent : null;
      const cbd = typeof cbdPercent === "number" ? cbdPercent : null;
      let rarityScore: number | null = null;
      let truthLayer: unknown = null;
      if (thc !== null && cbd !== null) {
        const metadata = {
          name: strain,
          type: "HYBRID" as const,
          genetics: ["Unknown"],
          thcContent: thc,
          cbdContent: cbd,
          harvestDate: new Date().toISOString(),
        };
        const profile = { thc, thca: thc * 1.12, cbd, cbda: cbd * 1.2, total: thc + cbd + 5 };
        rarityScore = calculateStrainRarity(metadata, profile);
        truthLayer = formatTruthLayerMetadata(metadata, profile);
      }

      res.json({
        verified: false,
        decision: "indeterminate",
        decision_contract: "AuthiChain Verification Decision v1",
        reasons: ["no_lab_evidence", "no_signed_attestation_presented"],
        strainName: strain,
        batchId: batchId || null,
        dispensaryId: dispensaryId || null,
        complianceStatus: "not_assessed",
        rarityScore,
        rarity_basis: rarityScore === null ? "not_computed" : "caller_supplied_panel",
        truthLayer,
      });
    } catch (err: unknown) {
      console.error("[Internal API] cannabis/verify error:", getErrorMessage(err));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/trust-score ────────────────────────────────────────
  router.post("/trust-score", async (req: Request, res: Response) => {
    try {
      const { qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk } = req.body;

      const score = computeTrustScore({
        qrDecodePass: qrDecodePass === true,
        blockchainCertExists: blockchainCertExists === true,
        communityVerified: visualMatch ? Math.round(visualMatch / 20) : 0,
        communityFlagged: 0,
        openArtRegistered: nfcMatch === true,
      });

      const { verdict: _heuristicVerdict, ...advisory } = score;
      res.json({
        ...advisory,
        advisory: true,
        verified: false,
        decision: "indeterminate",
        decision_contract: "AuthiChain Verification Decision v1",
        reasons: ["caller_asserted_signals_only"],
        inputs: { qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk },
      });
    } catch (err: unknown) {
      console.error("[Internal API] trust-score error:", getErrorMessage(err));
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
    } catch (err: unknown) {
      console.error("[Internal API] analytics error:", getErrorMessage(err));
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
    } catch (err: unknown) {
      console.error("[Internal API] products/register error:", getErrorMessage(err));
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
        records.map((r: { tenantId: string; endpoint: string; count: number }) =>
          reportUsageToStripe(r.tenantId, r.endpoint, r.count),
        ),
      );

      res.json({ success: true, processed: records.length });
    } catch (err: unknown) {
      console.error("[Internal API] usage/report error:", getErrorMessage(err));
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
    } catch (err: unknown) {
      console.error("[Internal API] tenant error:", getErrorMessage(err));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
