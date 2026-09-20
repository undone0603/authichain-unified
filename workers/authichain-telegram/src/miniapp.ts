/** Apex Mini App URL — BotFather Menu Button and /start web_app target. */
export const DEFAULT_MINIAPP_URL = 'https://authichain.com/telegram'
export const PASSPORT_CHECKOUT_URL =
  'https://authichain.com/api/checkout/plan/strainchain_passport'

export function miniAppUrl(env?: { MINIAPP_URL?: string }): string {
  const raw = env?.MINIAPP_URL?.trim()
  return raw || DEFAULT_MINIAPP_URL
}

export function startMessage(): string {
  return [
    `<b>AuthiChain</b>`,
    ``,
    `Publish a StrainChain genetics passport from your existing CoAs — <b>$49</b>.`,
    ``,
    `Open the Mini App for checkout, or send a TruMark™ ID (or /verify &lt;id&gt;) to check a product.`,
    ``,
    `Self-serve only — no scheduled calls.`,
  ].join('\n')
}

export function startReplyMarkup(url: string): object {
  return {
    inline_keyboard: [
      [{ text: 'Open Passport', web_app: { url } }],
      [{ text: 'Checkout — $49', url: PASSPORT_CHECKOUT_URL }],
    ],
  }
}

export function menuButtonPayload(url: string): object {
  return {
    menu_button: {
      type: 'web_app',
      text: 'Passport',
      web_app: { url },
    },
  }
}

/**
 * Webhook must be THIS worker, never https://authichain.com/api/telegram
 * (that path is the QRON Nightstamp Next.js route).
 */
export function webhookUrlFrom(
  request: Request,
  env?: { TELEGRAM_WEBHOOK_URL?: string }
): string {
  const override = env?.TELEGRAM_WEBHOOK_URL?.trim()
  if (override) return override
  return `${new URL(request.url).origin}/api/telegram/webhook`
}
