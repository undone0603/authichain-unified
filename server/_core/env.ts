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
  gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRefreshToken: process.env.GMAIL_REFRESH_TOKEN ?? "",
  gmailFromEmail: process.env.GMAIL_FROM_EMAIL ?? "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? "",
  suppressionList: process.env.SUPPRESSION_LIST ?? "",
  paddleApiKey: process.env.PADDLE_API_KEY ?? "",
  paddleWebhookSecret: process.env.PADDLE_WEBHOOK_SECRET ?? "",
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY ?? "",
  samGovApiKey: process.env.SAM_GOV_API_KEY ?? "",

  // ── Pipeline Flags ────────────────────────────────────────────────────────
  // Defaults to enabled unless explicitly disabled, to keep the revenue/autopilot
  // pipeline alive even when the env var is not present.
  autonomousPipelineEnabled: process.env.AUTONOMOUS_PIPELINE_ENABLED !== "false",
  requireOutreachApproval:   process.env.REQUIRE_OUTREACH_APPROVAL !== "false",
  requireDevApproval:        process.env.REQUIRE_DEV_APPROVAL !== "false",

  // ── Video / Media ─────────────────────────────────────────────────────────
  heygenApiKey: process.env.HEYGEN_API_KEY ?? "",
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
  qronAuthichainKey: process.env.QRON_AUTHICHAIN_KEY ?? "",
  makeWebhookUrl: process.env.MAKE_WEBHOOK_URL ?? "",
  smsRecipient: process.env.SMS_RECIPIENT ?? "",

  // ── Supabase ──────────────────────────────────────────────────────────────
  SUPABASE_URL: process.env.SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  // ── AI ────────────────────────────────────────────────────────────────────
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",

  // ── Paddle Price IDs ──────────────────────────────────────────────────────
  paddleBasicPriceId: process.env.PADDLE_BASIC_PRICE_ID ?? "",
  paddlePremiumPriceId: process.env.PADDLE_PREMIUM_PRICE_ID ?? "",
  paddleEnterprisePriceId: process.env.PADDLE_ENTERPRISE_PRICE_ID ?? "",

  // ── Blockchain ────────────────────────────────────────────────────────────
  defaultNftContract: process.env.DEFAULT_NFT_CONTRACT ?? process.env.AUTHICHAIN_NFT_CONTRACT ?? "",
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY ?? process.env.WALLET_PRIVATE_KEY ?? "",

  // ── Google OAuth ──────────────────────────────────────────────────────────
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  ownerEmails: process.env.OWNER_EMAILS ?? "",
};
