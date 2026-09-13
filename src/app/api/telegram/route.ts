import { NextRequest, NextResponse } from 'next/server';
import { generateLivingQR } from '@/lib/hf-generation';
import { supabaseAdmin as admin } from '@/lib/supabase-admin';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';

type TelegramMessage = {
  chat: { id: string | number };
  text?: string;
};

/**
 * QRON / Nightstamp Telegram storefront.
 *
 * Telegram Stars (XTR) are used for in-app digital-goods checkout. After a
 * successful payment, the customer is sent to the existing Nightstamp builder
 * so the paid fulfillment path remains the source of truth for the artifact.
 */
export async function POST(req: NextRequest) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      console.warn('[Telegram] TELEGRAM_BOT_TOKEN missing. Bot is inactive.');
      return NextResponse.json({ error: 'Bot inactive' }, { status: 503 });
    }

    const body = await req.json();

    if (body.pre_checkout_query) {
      await answerPreCheckoutQuery(body.pre_checkout_query.id, true);
      return NextResponse.json({ status: 'ok' });
    }

    const successfulPayment = body.message?.successful_payment;
    if (successfulPayment) {
      const chatId = body.message.chat.id;
      const payload = successfulPayment.invoice_payload || 'nightstamp_digital';
      const stars = successfulPayment.total_amount;

      await admin.from('automation_logs').insert({
        workflow_name: 'telegram_nightstamp_purchase',
        trigger_type: 'event',
        status: 'success',
        payload: JSON.stringify({
          chat_id: chatId,
          payload,
          stars,
          telegram_payment_charge_id: successfulPayment.telegram_payment_charge_id,
        }),
      });

      await sendTelegramMessage(
        chatId,
        `✅ Payment received (${stars} Telegram Stars).\n\nYour Nightstamp is ready to configure. Open the builder and enter the date, place, and dedication:\n${APP_URL}/starmap?ref=telegram_${String(chatId).slice(-8)}`,
      );
      return NextResponse.json({ status: 'ok' });
    }

    const message = body.message as TelegramMessage | undefined;
    if (!message?.text) return NextResponse.json({ status: 'ignored' });

    const chatId = message.chat.id;
    const text = message.text.trim();
    const command = text.split(/\s+/)[0].toLowerCase();

    if (command === '/start' || command === '/help') {
      await sendTelegramMessage(
        chatId,
        '✨ QRON Nightstamp\n\nTurn a real date + place into a beautiful, scannable star-map keepsake.\n\n/nightstamp — $9 digital Nightstamp\n/portal — $29 living Memory Portal\n/certified — $49 certified Nightstamp\n\nOr send a URL to generate a QRON.',
      );
      return NextResponse.json({ status: 'ok' });
    }

    if (command === '/nightstamp') {
      await sendTelegramInvoice(chatId, {
        slug: 'nightstamp_digital',
        title: 'Nightstamp Digital',
        description: '4K star-map QR art with a scannable Memory Portal link.',
        stars: 900,
      });
      return NextResponse.json({ status: 'ok' });
    }

    if (command === '/portal') {
      await sendTelegramInvoice(chatId, {
        slug: 'nightstamp_portal',
        title: 'Nightstamp Memory Portal',
        description: 'Living Nightstamp portal with photos, song, analytics, and revisions.',
        stars: 2900,
      });
      return NextResponse.json({ status: 'ok' });
    }

    if (command === '/certified') {
      await sendTelegramInvoice(chatId, {
        slug: 'nightstamp_certified',
        title: 'Certified Nightstamp',
        description: 'Nightstamp with AuthiChain certification and optional on-chain night hash.',
        stars: 4900,
      });
      return NextResponse.json({ status: 'ok' });
    }

    if (text.startsWith('http://') || text.startsWith('https://')) {
      await sendTelegramMessage(chatId, '🔄 Generating your QRON. This may take up to 20 seconds...');
      try {
        const result = await generateLivingQR({
          url: text,
          prompt: 'futuristic tech aesthetic, neon lights, highly detailed',
        });

        await sendTelegramPhoto(chatId, result.imageUrl, `✅ Your QRON is ready!\n\n🔒 Ed25519 Secured\n🔗 Target: ${text}`);
        await admin.from('automation_logs').insert({
          workflow_name: 'telegram_qron_generation',
          trigger_type: 'event',
          status: 'success',
          payload: JSON.stringify({ chat_id: chatId, url: text, image_url: result.imageUrl }),
        });
      } catch (err) {
        console.error('[Telegram] Generation failed:', err);
        await admin.from('automation_logs').insert({
          workflow_name: 'telegram_qron_generation',
          trigger_type: 'event',
          status: 'failure',
          payload: JSON.stringify({ chat_id: chatId, url: text }),
          error_message: err instanceof Error ? err.message : String(err),
        });
        await sendTelegramMessage(chatId, '❌ Generation failed. Please try again later.');
      }

      return NextResponse.json({ status: 'ok' });
    }

    await sendTelegramMessage(chatId, 'Try /nightstamp, /portal, or /certified — or send a valid URL to generate a QRON.');
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Telegram] Webhook error:', err);
    if (admin) {
      await admin.from('automation_logs').insert({
        workflow_name: 'telegram_webhook',
        trigger_type: 'event',
        status: 'failure',
        error_message: msg,
      });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function answerPreCheckoutQuery(id: string, ok: boolean) {
  await telegramApi('answerPreCheckoutQuery', {
    pre_checkout_query_id: id,
    ok,
    ...(ok ? {} : { error_message: 'Payment could not be processed. Please try again.' }),
  });
}

async function sendTelegramInvoice(
  chatId: string | number,
  product: { slug: string; title: string; description: string; stars: number },
) {
  await telegramApi('sendInvoice', {
    chat_id: chatId,
    title: product.title,
    description: product.description,
    payload: product.slug,
    currency: 'XTR',
    prices: [{ label: product.title, amount: product.stars }],
    provider_token: '',
    start_parameter: product.slug,
  });
}

async function sendTelegramMessage(chatId: string | number, text: string) {
  await telegramApi('sendMessage', { chat_id: chatId, text });
}

async function sendTelegramPhoto(chatId: string | number, photoUrl: string, caption: string) {
  await telegramApi('sendPhoto', { chat_id: chatId, photo: photoUrl, caption });
}
