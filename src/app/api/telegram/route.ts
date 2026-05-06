import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateLivingQR } from '@/lib/hf-generation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * TELEGRAM BOT WEBHOOK (qron-telegram)
 * Reintegrating the legacy revenue channel for direct-to-consumer generation.
 */
export async function POST(req: NextRequest) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('[Telegram] TELEGRAM_BOT_TOKEN missing. Bot is inactive.');
      return NextResponse.json({ error: 'Bot inactive' }, { status: 503 });
    }

    const body = await req.json();
    const message = body.message;

    if (!message || !message.text) {
      return NextResponse.json({ status: 'ignored' });
    }

    const chatId = message.chat.id;
    const text = message.text;

    // Command: /start
    if (text.startsWith('/start')) {
      await sendTelegramMessage(chatId, 'Welcome to the AuthiChain Protocol. Send me a URL and I will generate a cryptographically-signed QRON for you. (Beta Phase)');
      return NextResponse.json({ status: 'ok' });
    }

    // Command: Generate QRON
    if (text.startsWith('http://') || text.startsWith('https://')) {
      await sendTelegramMessage(chatId, 'ðŸ”„ Generating your QRON. This may take up to 20 seconds...');
      
      try {
        const result = await generateLivingQR({
          url: text,
          prompt: 'futuristic tech aesthetic, neon lights, highly detailed',
        });
        
        await sendTelegramPhoto(chatId, result.imageUrl, `âœ… Your QRON is ready!\n\nðŸ”’ Ed25519 Secured\nðŸ”— Target: ${text}`);
      } catch (err) {
        await sendTelegramMessage(chatId, 'â Œ Generation failed. Please try again later.');
      }
      
      return NextResponse.json({ status: 'ok' });
    }

    await sendTelegramMessage(chatId, 'Send me a valid URL (starting with http/https) to generate a QRON.');
    return NextResponse.json({ status: 'ok' });

  } catch (err) {
    console.error('[Telegram] Webhook error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendTelegramPhoto(chatId: string | number, photoUrl: string, caption: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }),
  });
}
