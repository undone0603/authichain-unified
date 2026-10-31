import { registryLookupDecision } from "../packages/verifier/src/registry-decision";
import { timingSafeEqual } from "crypto";
import { Router, type Request, type Response } from "express";
import { ENV } from "./_core/env";
import { cannabisCallerNumbers } from "./cannabis-verify";
import {
  createProduct,
  getCertificateByNumber,
  getCertificateForProduct,
  getDb,
  getProductById,
  getProductByName,
  getProductBySerial,
  getWhiteLabelByApiKey,
} from "./db";
import { analyticsResponse, finishPassportScan } from "./passport-scan-log";
import {
  callerSignalReport,
  passportVerdict,
  trustScoreReply,
} from "./passport-verdict";
import { generateProductQRON } from "./qron-service";
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
    if (
      !secret ||
      typeof secret !== "string" ||
      !timingSafeStringEqual(secret, ENV.internalApiSecret)
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  });

  // ─── POST /api/internal/verify ──────────────────────────────────────────────
  router.post("/verify", async (req: Request, res: Response) => {
    try {
      const { identifier, productId, barcode } = req.body;
      const lookupId = identifier || productId || barcode;
      if (!lookupId)
        return res
          .status(400)
          .json({ error: "identifier, productId, or barcode required" });

      // Check if it's a certificate number
      const cert = await getCertificateByNumber(String(lookupId));
      const product =
        (cert?.productId
          ? await getProductById(String(cert.productId))
          : undefined) ??
        (await getProductBySerial(String(lookupId))) ??
        (await getProductById(String(lookupId)));
      const verdict = passportVerdict(product, cert);
      await finishPassportScan(verdict);
      res.json({
        type: "product_passport",
        ...verdict,
        ...(cert ? { certificate: cert } : {}),
      });
    } catch (err: unknown) {
      console.error("[Internal API] verify error:", getErrorMessage(err));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/qr/generate ──────────────────────────��─────────────
  router.post("/qr/generate", async (req: Request, res: Response) => {
    try {
      const {
        url,
        data,
        style,
        productName,
        brand,
        productId,
        _unused_prompt_95,
      } = req.body;
      const qrData = url || data;
      if (!qrData)
        return res.status(400).json({ error: "url or data required" });

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
      const number = typeof raw === "string" ? raw : undefined;
      if (!number)
        return res
          .status(400)
          .json({ error: "certNumber body field required" });
      if (number.length > 64)
        return res.status(400).json({ error: "certNumber too long" });

      const cert = await getCertificateByNumber(number);
      if (!cert)
        return res
          .status(404)
          .json({ error: "Certificate not found", valid: false });

      const product = cert.productId
        ? await getProductById(String(cert.productId))
        : undefined;
      const verdict = passportVerdict(product, cert);
      res.json({
        ...verdict,
        valid: verdict.verified,
        certificate: cert,
        issuedAt: cert.issuedAt,
        expiresAt: cert.expiresAt,
      });
    } catch (err: unknown) {
      console.error(
        "[Internal API] certificates/verify error:",
        getErrorMessage(err)
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/cannabis/verify ────────────────────────────────────
  router.post("/cannabis/verify", async (req: Request, res: Response) => {
    try {
      const {
        strainId,
        strainName,
        dispensaryId,
        batchId,
        thcPercent,
        cbdPercent,
      } = req.body;
      const strain = strainName || strainId;
      if (!strain)
        return res
          .status(400)
          .json({ error: "strainName or strainId required" });

      const product = await getProductByName(String(strain));

      res.json({
        ...passportVerdict(product, null),
        strainName: strain,
        ...cannabisCallerNumbers({
          thcPercent,
          cbdPercent,
          batchId,
          dispensaryId,
        }),
      });
    } catch (err: unknown) {
      console.error(
        "[Internal API] cannabis/verify error:",
        getErrorMessage(err)
      );
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/trust-score ────────────────────────────────────────
  // Caller flags are recorded. verified follows a stored passport when a product id is present.
  router.post("/trust-score", async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const callerSignals = callerSignalReport(body);
      const rawId = body.productId ?? body.identifier;
      const id = typeof rawId === "string" ? rawId.trim() : "";
      if (!id) {
        return res.json(trustScoreReply(null, callerSignals));
      }
      const product =
        (await getProductById(id)) ?? (await getProductBySerial(id));
      const cert = product
        ? await getCertificateForProduct(String(product.id))
        : undefined;
      res.json(
        trustScoreReply(passportVerdict(product, cert ?? null), callerSignals)
      );
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
      const reply = await analyticsResponse(period, db);
      res.status(reply.status).json(reply.body);
    } catch (err: unknown) {
      console.error("[Internal API] analytics error:", getErrorMessage(err));
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ─── POST /api/internal/products/register ──────────────────────────────────
  router.post("/products/register", async (req: Request, res: Response) => {
    try {
      const {
        name,
        brand,
        manufacturer,
        category,
        serialNumber,
        description,
        userId,
      } = req.body;
      if (!name) return res.status(400).json({ error: "name required" });
      const parsedUserId = parseInt(userId, 10);
      if (!userId || !Number.isFinite(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ error: "valid userId required" });
      }

      const { productPassportMetadata, digitalIdentityOf } =
        await import("../protocol/passport.mjs");
      let metadata: Record<string, unknown> | null = null;
      if (req.body?.passport != null || req.body?.metadata?.passport != null) {
        try {
          metadata = productPassportMetadata(req.body);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "passport_invalid";
          return res.status(400).json({ error: message });
        }
      }

      const resolvedBrand = brand || manufacturer;
      const product = await createProduct({
        name,
        brand: resolvedBrand,
        manufacturer: manufacturer || brand,
        category,
        serialNumber,
        description,
        userId: parsedUserId,
        status: "active",
        ...(metadata ? { metadata } : {}),
      });
      const digitalIdentity = digitalIdentityOf(metadata);

      res.json({
        success: true,
        product,
        ...(digitalIdentity ? { digitalIdentity } : {}),
      });
    } catch (err: unknown) {
      console.error(
        "[Internal API] products/register error:",
        getErrorMessage(err)
      );
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
        records.map(
          (r: { tenantId: string; endpoint: string; count: number }) =>
            reportUsageToStripe(r.tenantId, r.endpoint, r.count)
        )
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
      const apiKey = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      if (!apiKey)
        return res
          .status(400)
          .json({ error: "Authorization: Bearer <apiKey> required" });

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
