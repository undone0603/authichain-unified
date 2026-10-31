/**
 * Vitest setup: tests never inherit the developer's real delivery credentials.
 *
 * Notification code falls back to process.env (src/lib/founder-alerts.ts and
 * friends), so a RESEND_API_KEY exported in the shell turned "skips Resend
 * when no key is bound" into an extra send attempt: 8 tests failed locally
 * and passed in CI, where the key is absent. fetch is mocked in those tests,
 * but the next one might not be. A test that needs a key sets its own.
 */
const DELIVERY_ENV = [
  "RESEND_API_KEY",
  "RESEND_API_KEY2",
  "RESEND_INBOUND_API_KEY",
  "SENDGRID_API_KEY",
  "NTFY_TOKEN",
  "SLACK_BOT_TOKEN",
  "TELEGRAM_BOT_TOKEN",
] as const;

for (const name of DELIVERY_ENV) delete process.env[name];
