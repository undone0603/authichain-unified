import { Router } from "express";
import { db } from "../db";
import { products, certificates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { passportVerdict } from "../passport-verdict";

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
    const id = String(productId);
    const [byId] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    const product = byId ?? (await db.select().from(products).where(eq(products.serialNumber, id)).limit(1))[0];
    if (!product) return res.json(passportVerdict(null, null));
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    const decision = registryLookupDecision(cert ?? { status: "uncertified" });
    return res.json({
      ...passportVerdict(product, cert ?? null),
      productName: product.name,
      brand: product.brand ?? null,
      certificateId: cert?.id ?? null,
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
    if (!cert) return res.json({ valid: false, message: "Certificate not found" });
    const [product] = cert.productId
      ? await db.select().from(products).where(eq(products.id, cert.productId)).limit(1)
      : [];
    const verdict = passportVerdict(product, cert);
    return res.json({
      ...verdict,
      valid: verdict.verified,
      certificateId: cert.id,
      issuedAt: cert.issuedAt,
    });
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
      ...passportVerdict(product, null),
      strainName: strainName || "Unknown",
      batchId: batchId || null,
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
    const id = String(productId);
    const [byId] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    const product = byId ?? (await db.select().from(products).where(eq(products.serialNumber, id)).limit(1))[0];
    if (!product) return res.json({ verdict: "UNKNOWN", ...passportVerdict(null, null) });
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    const scan = passportVerdict(product, cert ?? null);
    return res.json({
      ...scan,
      verdict: scan.verified ? "GENUINE" : "UNVERIFIED",
      productName: product.name,
    });
  } catch (err) {
    console.error("[GPT /trust-score]", err);
    res.status(500).json({ error: "Trust score computation failed" });
  }
});

export default router;
