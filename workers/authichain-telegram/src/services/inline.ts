import type { Env } from '../index'
import type { Telegram } from './telegram'
import type { TelegramUpdate } from './db'

export async function handleInline(
  env: Env,
  telegram: Telegram,
  update: TelegramUpdate
): Promise<Response> {
  const query = update.inline_query!.query.trim()
  const inlineQueryId = update.inline_query!.id

  // If query looks like a TrueMark ID, attempt live verification
  if (/^TM-\d+-[A-Z0-9]+$/i.test(query)) {
    try {
      const res = await fetch(`${env.SITE_URL}/api/verify/${encodeURIComponent(query)}`)
      if (res.ok) {
        const data: any = await res.json()
        const product = data.product
        return telegram.answerInlineQuery(inlineQueryId, [
          {
            type: 'article',
            id: query,
            title: `✅ ${product.name} — AUTHENTIC`,
            description: [product.brand, product.category].filter(Boolean).join(' · '),
            input_message_content: {
              message_text: `✅ <b>AUTHENTIC</b> — ${product.name}\nTrueMark™: <code>${query}</code>`,
              parse_mode: 'HTML',
            },
          },
        ])
      }
    } catch {}

    return telegram.answerInlineQuery(inlineQueryId, [
      {
        type: 'article',
        id: 'not-found',
        title: `⚠️ Not found: ${query}`,
        description: 'No product registered with this TrueMark™ ID',
        input_message_content: {
          message_text: `⚠️ No product found for TrueMark™ ID: <code>${query}</code>`,
          parse_mode: 'HTML',
        },
      },
    ])
  }

  // Default: help prompt
  return telegram.answerInlineQuery(inlineQueryId, [
    {
      type: 'article',
      id: 'help',
      title: '🛡️ AuthiChain Product Verification',
      description: 'Type a TrueMark™ ID (e.g. TM-1234567890-ABCD1234) to verify',
      input_message_content: {
        message_text: '🛡️ Use @AuthiChainBot followed by a TrueMark™ ID to verify product authenticity.',
      },
    },
  ])
}
