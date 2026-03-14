import { Router } from "express";
import { ENV } from "./_core/env";

/**
 * Diagnostic endpoint to check environment configuration
 * REMOVE THIS IN PRODUCTION!
 */
export const diagnosticRouter = Router();

diagnosticRouter.get("/api/diagnostic/env", (req, res) => {
  // Only show first/last 4 characters of sensitive values
  const maskValue = (val: string) => {
    if (!val) return "NOT SET";
    if (val.length <= 8) return "***";
    return `${val.substring(0, 4)}...${val.substring(val.length - 4)}`;
  };

  const envStatus = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    paddle: {
      apiKey: maskValue(ENV.paddleApiKey),
      apiKeyType: ENV.paddleApiKey.startsWith('pdl_live_') ? 'LIVE' : 'SANDBOX',
      webhookSecret: maskValue(ENV.paddleWebhookSecret),
      basicPriceId: ENV.paddleBasicPriceId || "NOT SET",
      premiumPriceId: ENV.paddlePremiumPriceId || "NOT SET",
      enterprisePriceId: ENV.paddleEnterprisePriceId || "NOT SET",
    },
    raw: {
      PADDLE_BASIC_PRICE_ID: process.env.PADDLE_BASIC_PRICE_ID || "NOT SET",
      PADDLE_PREMIUM_PRICE_ID: process.env.PADDLE_PREMIUM_PRICE_ID || "NOT SET",
      PADDLE_ENTERPRISE_PRICE_ID: process.env.PADDLE_ENTERPRISE_PRICE_ID || "NOT SET",
    }
  };

  res.json(envStatus);
});
