export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  thirdwebClientId: process.env.VITE_THIRDWEB_CLIENT_ID ?? "",
  thirdwebSecretKey: process.env.thirdweb_api_key ?? "",
  hubspotServiceKey: process.env.HUBSPOT_SERVICE_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  suppressionList: process.env.SUPPRESSION_LIST ?? "",
  requireOutreachApproval: (process.env.REQUIRE_OUTREACH_APPROVAL ?? "true").toLowerCase() !== "false",
  discountApprovalThresholdPercent: Number(process.env.DISCOUNT_APPROVAL_THRESHOLD_PERCENT ?? "20"),
  llmMonthlyBudgetUsd: Number(process.env.LLM_MONTHLY_BUDGET_USD ?? "500"),
  llmPerRequestBudgetUsd: Number(process.env.LLM_PER_REQUEST_BUDGET_USD ?? "0.1"),
  adsDailyCapUsd: Number(process.env.ADS_DAILY_CAP_USD ?? "300"),
  enrichmentMonthlyCapUsd: Number(process.env.ENRICHMENT_MONTHLY_CAP_USD ?? "200"),
  requireSchemaMigrationApproval:
    (process.env.REQUIRE_SCHEMA_MIGRATION_APPROVAL ?? "true").toLowerCase() !== "false",
  apolloApiKey: process.env.APOLLO_API_KEY ?? "",
  gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
  gmailFromEmail: process.env.GMAIL_FROM_EMAIL ?? "",
  autonomousPipelineEnabled:
    (process.env.AUTONOMOUS_PIPELINE_ENABLED ?? "false").toLowerCase() === "true",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS
    ?? "https://authichain.com,https://www.authichain.com")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean),
};
