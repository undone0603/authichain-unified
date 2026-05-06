import { config } from 'dotenv';
config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
const WEBHOOK_URL = `${NEXT_PUBLIC_APP_URL}/api/telegram`;

async function registerWebhook() {
  console.log(`🤖 Initializing Telegram Bot Webhook Registration...`);

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ ERROR: TELEGRAM_BOT_TOKEN is not set in your .env file.');
    console.error('Please obtain a token from @BotFather on Telegram and set it before running this script.');
    process.exit(1);
  }

  console.log(`🔗 Target Webhook URL: ${WEBHOOK_URL}`);

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      console.log('✅ SUCCESS: Telegram Webhook registered successfully!');
      console.log(`The bot is now active and routing messages to your production endpoint.`);
    } else {
      console.error('❌ API ERROR:', data.description);
    }
  } catch (error: any) {
    console.error('💥 NETWORK ERROR:', error.message);
  }
}

registerWebhook();
