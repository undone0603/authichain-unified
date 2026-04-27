import type { Env } from '../index'
import type { Telegram } from './telegram'
import type { TelegramUpdate } from './db'

export async function handleCommand(
  env: Env,
  telegram: Telegram,
  update: TelegramUpdate
): Promise<Response> {
  const text = update.message?.text ?? ''
  const chatId = update.message!.chat.id
  const userId = update.message!.from.id

  if (text.startsWith('/start')) {
    return telegram.sendMessage(
      chatId,
      `🛡️ <b>AuthiChain Bot</b>\n\nVerify product authenticity using TrueMark™ IDs.\n\nSend a TrueMark™ ID (e.g. <code>TM-1234567890-ABCD1234</code>) to verify a product, or use /help for available commands.`,
      { parse_mode: 'HTML' }
    )
  }

  if (text.startsWith('/help')) {
    return telegram.sendMessage(
      chatId,
      `<b>Available commands</b>\n\n/start — Welcome message\n/verify &lt;TrueMark ID&gt; — Verify a product\n/status — Check bot status\n/broadcast — Get QRON broadcast message\n/channel — Get QRON channel template\n/help — Show this message`,
      { parse_mode: 'HTML' }
    )
  }

  if (text.startsWith('/status')) {
    return telegram.sendMessage(chatId, '✅ AuthiChain Bot is online.')
  }

  if (text.startsWith('/verify ')) {
    const truemarkId = text.replace('/verify ', '').trim()
    return handleVerify(env, telegram, chatId, truemarkId)
  }

  if (text.startsWith('/broadcast')) {
    const broadcastMsg = `To broadcast to @qrontoken_bot users, forward this message to the channel and post:\n\n<b>QRON = AI QR codes + blockchain authentication. Scannable artwork from $9.</b>\n\nhttps://qron.space | /buy at @qrontoken_bot\n\nTop Telegram groups to target:\n- r/CryptoMoonShots\n- QR code maker groups\n- Cannabis/dispensary groups (for StrainChain)\n- NFT/Web3 communities`
    return telegram.sendMessage(chatId, broadcastMsg, { parse_mode: 'HTML' })
  }

  if (text.startsWith('/channel')) {
    const channelMsg = `📣 <b>Channel Post Template</b>\n\nCopy this message and post it in any Telegram channel you have access to:\n\n━━━━━━━━━━━━\n\n✨ <b>QRON — AI-Generated QR Art</b>\n\nTurn any link into scannable art from $9.\n\n• 11 visual modes (Holographic, Kinetic, NFT Mint...)\n• Blockchain-verified provenance\n• Enterprise-ready API\n\n👉 <a href=\"https://t.me/qrontoken_bot?start=promo\">Try it now</a> | <a href=\"https://qron.space\">qron.space</a>\n\n━━━━━━━━━━━━`
    return telegram.sendMessage(chatId, channelMsg, { parse_mode: 'HTML' })
  }

  if (text.startsWith('/admin') && String(userId) === env.TELEGRAM_ADMIN_CHAT_ID) {
    return telegram.sendMessage(chatId, '🔐 Admin panel ready.', { parse_mode: 'HTML' })
  }

  // If message looks like a TrueMark ID, auto-verify
  if (/^TM-\\d+-[A-Z0-9]+$/i.test(text.trim())) {
    return handleVerify(env, telegram, chatId, text.trim())
  }

  return telegram.sendMessage(chatId, "Unknown command. Send /help for a list of commands.")
}

async function handleVerify(
  env: Env,
  telegram: Telegram,
  chatId: number,
  truemarkId: string
): Promise<Response> {
  try {
    const res = await fetch(`${env.SITE_URL}/api/verify/${encodeURIComponent(truemarkId)}`)

    if (res.status === 404) {
      return telegram.sendMessage(
        chatId,
        `⚠️ <b>Not Found</b>\n\nNo product found for TrueMark ID: <code>${truemarkId}</code>\n\nThis product may not be registered or the ID may be incorrect.`,
        { parse_mode: 'HTML' }
      )
    }

    if (!res.ok) {
      return telegram.sendMessage(chatId, '❌ Verification service unavailable. Please try again.')
    }

    const data: any = await res.json()
    const product = data.product

    const lines = [
      `✅ <b>AUTHENTIC</b>`,
      ``,
      `<b>${product.name}</b>`,
      product.brand ? `Brand: ${product.brand}` : null,
      product.category ? `Category: ${product.category}` : null,
      ``,
      `🔗 TrueMark™: <code>${truemarkId}</code>`,
      product.blockchain_tx_hash ? `📦 Tx: <code>${product.blockchain_tx_hash.slice(0, 20)}…</code>` : null,
    ]
      .filter(Boolean)
      .join('\\n')

    return telegram.sendMessage(chatId, lines, { parse_mode: 'HTML' })
  } catch {
    return telegram.sendMessage(chatId, '❌ Failed to verify product. Please try again.')
  }
}
