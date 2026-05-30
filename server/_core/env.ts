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
  sendgridApiKey: process.env.SENDGRID_API_KEY ?? "",
  apolloApiKey: process.env.APOLLO_API_KEY ?? "",

  // ── Email ─────────────────────────────────────────────────────────────────
  resendApiKey:         process.env.RESEND_API_KEY ?? "",
  resendFromEmail:      process.env.RESEND_FROM_EMAIL ?? "noreply@authichain.com",
  gmailFromEmail:       process.env.GMAIL_FROM_EMAIL ?? "",
  gmailClientId:        process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret:    process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRefreshToken:    process.env.GMAIL_REFRESH_TOKEN ?? "",
  gmailAppPassword:     process.env.GMAIL_APP_PASSWORD ?? "",
  suppressionList:      process.env.SUPPRESSION_LIST ?? "",

  // ── AI / LLM ──────────────────────────────────────────────────────────────
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  groqApiKey:       process.env.GROQ_API_KEY ?? "",
  openaiApiKey:     process.env.OPENAI_API_KEY ?? "",
  geminiApiKey:     process.env.GEMINI_API_KEY ?? "",

  // ── Blockchain / Wallet ───────────────────────────────────────────────────
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY ?? "",

  // ── Gov / External APIs ───────────────────────────────────────────────────
  samGovApiKey: process.env.SAM_GOV_API_KEY ?? "",

  // ── Pipeline Flags ────────────────────────────────────────────────────────
  autonomousPipelineEnabled: process.env.AUTONOMOUS_PIPELINE_ENABLED === "true",
  requireOutreachApproval:   process.env.REQUIRE_OUTREACH_APPROVAL !== "false",
  requireDevApproval:        process.env.REQUIRE_DEV_APPROVAL !== "false",

  // ── Video / Media ─────────────────────────────────────────────────────────
  heygenApiKey: process.env.HEYGEN_API_KEY ?? "",
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
  qronAuthichainKey: process.env.QRON_AUTHICHAIN_KEY ?? "",
  makeWebhookUrl: process.env.MAKE_WEBHOOK_URL ?? "",
  smsRecipient: process.env.SMS_RECIPIENT ?? "",
};
