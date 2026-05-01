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
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY ?? "",
  hubspotServiceKey: process.env.HUBSPOT_SERVICE_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  qronAuthichainKey: process.env.QRON_AUTHICHAIN_KEY ?? "",
  defaultNftContract: process.env.DEFAULT_NFT_CONTRACT ?? "0xc3143254997d48fdc9983d618fb2e10067673eb5",

  // ── Autonomous Revenue Pipeline ──────────────────────────────────────────
  autonomousPipelineEnabled: process.env.AUTONOMOUS_PIPELINE_ENABLED === "true",
  requireOutreachApproval:   process.env.REQUIRE_OUTREACH_APPROVAL !== "false",
  requireDevApproval:        process.env.REQUIRE_SCHEMA_MIGRATION_APPROVAL !== "false",
  suppressionList:           process.env.SUPPRESSION_LIST ?? "",

  // ── Lead Discovery (Apollo.io) ────────────────────────────────────────────
  apolloApiKey: process.env.APOLLO_API_KEY ?? "",

  // ── Email ─────────────────────────────────────────────────────────────────
  resendApiKey:         process.env.RESEND_API_KEY ?? "",
  gmailFromEmail:       process.env.GMAIL_FROM_EMAIL ?? "",
  gmailClientId:        process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret:    process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRefreshToken:    process.env.GMAIL_REFRESH_TOKEN ?? "",

  // ── AI / LLM ──────────────────────────────────────────────────────────────
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  groqApiKey:       process.env.GROQ_API_KEY ?? "",
  openaiApiKey:     process.env.OPENAI_API_KEY ?? "",
  geminiApiKey:     process.env.GEMINI_API_KEY ?? "",

  // ── Video / Media ─────────────────────────────────────────────────────────
  heygenApiKey: process.env.HEYGEN_API_KEY ?? "",

  // ── Budget guardrails ─────────────────────────────────────────────────────
  llmMonthlyBudgetUsd:    Number(process.env.LLM_MONTHLY_BUDGET_USD    ?? 500),
  llmPerRequestBudgetUsd: Number(process.env.LLM_PER_REQUEST_BUDGET_USD ?? 0.10),
  adsDailyCapUsd:         Number(process.env.ADS_DAILY_CAP_USD          ?? 300),
  enrichmentMonthlyCapUsd:Number(process.env.ENRICHMENT_MONTHLY_CAP_USD ?? 200),

  // ── SMS / Owner alerts ──────────────────────────────────────────────────
  smsRecipient: process.env.SMS_RECIPIENT ?? "",

  // ── Integrations ─────────────────────────────────────────────────────────
  airtableBaseId:  process.env.AIRTABLE_BASE_ID  ?? "",
  airtableApiKey:  process.env.AIRTABLE_API_KEY  ?? "",
  makeWebhookUrl:  process.env.MAKE_WEBHOOK_URL  ?? "",
  posthogApiKey:   process.env.POSTHOG_API_KEY   ?? "",

  // ── Internal Gateway ────────────────────────────────────────────────────
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "dev-internal-secret",
};
