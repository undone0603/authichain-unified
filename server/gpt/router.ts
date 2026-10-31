import { Router } from "express";
import { db } from "../db";
import { products, certificates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { registryLookupDecision } from "../../packages/verifier/src/registry-decision";

const router = Router();

/**
 * GPT Plugin REST endpoints
 * These correspond to the paths in knowledge/GPT_OPENAPI_SPEC.yaml
 */

// POST /api/gpt/verify - Verify product authenticity
router.post("/verify", async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ error: "productId required" });
    }
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    // Same contract as worker-app/index.ts: a registry lookup never verifies.
    if (!product) {
      return res.json({ verified: false, trustScore: null, ...registryLookupDecision(null) });
    }
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    const decision = registryLookupDecision(cert ?? { status: "uncertified" });
    return res.json({
      verified: decision.valid,
      trustScore: null,
      productName: product.name,
      brand: product.brand ?? null,
      certificateId: cert?.id ?? null,
      ...decision,
    });
  } catch (err) {
    console.error("[GPT /verify]", err);
    res.status(500).json({ error: "Internal error during verification" });
  }
});

// POST /api/gpt/qr/generate - Generate a QR code
router.post("/qr/generate", async (req, res) => {
  try {
    const { productId, style, size } = req.body;
    if (!productId) return res.status(400).json({ error: "productId required" });
    const verifyUrl = `https://authichain.com/verify/${productId}`;
    return res.json({
      qrUrl: verifyUrl,
      embedUrl: `https://authichain.com/api/qr/${productId}?style=${style || "default"}&size=${size || 256}`,
      message: `QR code generated for product ${productId}`,
    });
  } catch (err) {
    console.error("[GPT /qr/generate]", err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

// GET /api/gpt/certificates/verify - Check certificate by number
router.get("/certificates/verify", async (req, res) => {
  try {
    const { certNumber } = req.query;
    if (!certNumber) return res.status(400).json({ error: "certNumber required" });
    if (String(certNumber).length > 64) return res.status(400).json({ error: "certNumber too long" });
    const [cert] = await db.select().from(certificates).where(eq(certificates.certificateNumber, String(certNumber))).limit(1);
    if (!cert) return res.json(registryLookupDecision(null));
    return res.json({ certificateId: cert.id, issuedAt: cert.issuedAt, ...registryLookupDecision(cert) });
  } catch (err) {
    console.error("[GPT /certificates/verify]", err);
    res.status(500).json({ error: "Certificate check failed" });
  }
});

// POST /api/gpt/cannabis/verify - Verify cannabis strain (by product name)
router.post("/cannabis/verify", async (req, res) => {
  try {
    const { strainName, batchId } = req.body;
    if (!batchId && !strainName) {
      return res.status(400).json({ error: "strainName or batchId required" });
    }
    const [product] = strainName
      ? await db.select().from(products).where(eq(products.name, strainName)).limit(1)
      : [];
    const decision = registryLookupDecision(product ? { status: "name_match" } : null);
    return res.json({
      verified: decision.valid,
      strainName: strainName || null,
      batchId: batchId || null,
      metrc_compliance: "not_assessed",
      ...decision,
    });
  } catch (err) {
    console.error("[GPT /cannabis/verify]", err);
    res.status(500).json({ error: "Cannabis verification failed" });
  }
});

// POST /api/gpt/trust-score - Compute trust score
router.post("/trust-score", async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ error: "productId required" });
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return res.json({ trustScore: null, ...registryLookupDecision(null) });
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    return res.json({
      trustScore: null,
      productName: product.name,
      ...registryLookupDecision(cert ?? { status: "uncertified" }),
    });
  } catch (err) {
    console.error("[GPT /trust-score]", err);
    res.status(500).json({ error: "Trust score computation failed" });
  }
});

export default router;
