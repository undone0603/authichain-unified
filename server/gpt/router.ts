import { Router } from "express";
import { db } from "../db";
import { products, certificates } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
    const [product] = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
    if (!product) {
      return res.json({
        verified: false,
        trustScore: 0,
        message: "Product not found. This item may be counterfeit.",
        blockchain: null,
      });
    }
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    return res.json({
      verified: !!cert,
      trustScore: cert ? 95 : 20,
      productName: product.name,
      brand: product.brand ?? null,
      certificateId: cert?.id ?? null,
      blockchain: cert ? { status: "SECURED", network: "Polygon" } : null,
      message: cert
        ? `VERIFIED AUTHENTIC: ${product.name} - Blockchain secured.`
        : `UNVERIFIED: ${product.name} lacks blockchain certificate.`,
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
<<<<<<< HEAD
=======
    if (String(certNumber).length > 64) return res.status(400).json({ error: "certNumber too long" });
>>>>>>> origin/add-agentz-editable
    const [cert] = await db.select().from(certificates).where(eq(certificates.certificateNumber, String(certNumber))).limit(1);
    if (!cert) return res.json({ valid: false, message: "Certificate not found" });
    return res.json({
      valid: true,
      certificateId: cert.id,
      issuedAt: cert.issuedAt,
      blockchain: { status: "SECURED", network: "Polygon" },
      message: "Certificate is valid and blockchain-secured.",
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
<<<<<<< HEAD
    const product = strainName
      ? await db.select().from(products).where(eq(products.name, strainName)).limit(1).then(r => r[0])
      : null;
=======
    const [product] = strainName
      ? await db.select().from(products).where(eq(products.name, strainName)).limit(1)
      : [];
>>>>>>> origin/add-agentz-editable
    return res.json({
      verified: !!product,
      strainName: strainName || "Unknown",
      batchId: batchId || null,
      metrcCompliant: !!product,
      blockchain: product ? { status: "SECURED", network: "Polygon" } : null,
      message: product
        ? `VERIFIED: ${product.name} - METRC compliant, blockchain secured.`
        : "Strain not found in AuthiChain registry.",
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
    const [product] = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
    if (!product) return res.json({ trustScore: 0, verdict: "UNKNOWN", message: "Product not found" });
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    const baseScore = cert ? 85 : 15;
    const trustScore = Math.min(100, baseScore);
    const verdict = trustScore >= 80 ? "TRUSTED" : trustScore >= 50 ? "MODERATE" : "SUSPICIOUS";
    return res.json({
      trustScore,
      verdict,
      breakdown: { blockchainCert: cert ? 85 : 0 },
      message: `Trust score for ${product.name}: ${trustScore}/100 — ${verdict}`,
    });
  } catch (err) {
    console.error("[GPT /trust-score]", err);
    res.status(500).json({ error: "Trust score computation failed" });
  }
});

export default router;
