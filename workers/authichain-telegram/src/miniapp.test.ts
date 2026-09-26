import { test } from "node:test";
import assert from "node:assert/strict";
import { planPaymentLink } from "../../../src/lib/plans.ts";
import worker from "./index.ts";
import {
  DEFAULT_MINIAPP_URL,
  PASSPORT_CHECKOUT_URL,
  menuButtonPayload,
  miniAppUrl,
  startMessage,
  startReplyMarkup,
  webhookUrlFrom,
} from "./miniapp.ts";

const ENV = {
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_WEBHOOK_SECRET: "secret",
  TELEGRAM_ADMIN_CHAT_ID: "",
  SITE_URL: "https://authichain.com",
} as unknown as Parameters<typeof worker.fetch>[1];

test("GET / and /telegram redirect to the apex Mini App", async () => {
  for (const path of ["/", "/telegram"]) {
    const res = await worker.fetch(
      new Request(`https://authichain-telegram.example.workers.dev${path}`),
      ENV,
      { waitUntil() {} } as never
    );
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get("location"), DEFAULT_MINIAPP_URL);
  }
});

test("Mini App defaults to the apex URL, never authichain.com/api/telegram", () => {
  assert.equal(miniAppUrl({}), DEFAULT_MINIAPP_URL);
  assert.equal(
    miniAppUrl({ MINIAPP_URL: "  https://example.com/x  " }),
    "https://example.com/x"
  );
  assert.equal(DEFAULT_MINIAPP_URL, "https://authichain.com/telegram");
  assert.equal(PASSPORT_CHECKOUT_URL, planPaymentLink("strainchain_passport"));
  // Gated confirm page: a GET (Telegram link preview) never opens a Stripe session.
  assert.equal(
    PASSPORT_CHECKOUT_URL,
    "https://authichain.com/checkout/strainchain_passport"
  );
  assert.equal(PASSPORT_CHECKOUT_URL.includes("/api/checkout"), false);
});

test("/start markup is a WebApp button plus live Passport checkout", () => {
  const markup = startReplyMarkup(DEFAULT_MINIAPP_URL) as {
    inline_keyboard: {
      text: string;
      web_app?: { url: string };
      url?: string;
    }[][];
  };
  assert.equal(markup.inline_keyboard[0][0].web_app?.url, DEFAULT_MINIAPP_URL);
  assert.equal(markup.inline_keyboard[1][0].url, PASSPORT_CHECKOUT_URL);
  const msg = startMessage();
  assert.match(msg, /\$49/);
  assert.doesNotMatch(msg, /Series A/);
  assert.doesNotMatch(msg, /Inc/);
});

test("setChatMenuButton payload points at the Mini App", () => {
  const body = menuButtonPayload(DEFAULT_MINIAPP_URL) as {
    menu_button: { type: string; web_app: { url: string } };
  };
  assert.equal(body.menu_button.type, "web_app");
  assert.equal(body.menu_button.web_app.url, DEFAULT_MINIAPP_URL);
});

test("webhook URL uses this worker origin, not SITE_URL/api/telegram", () => {
  const req = new Request(
    "https://authichain-telegram.example.workers.dev/api/telegram/setup-webhook"
  );
  assert.equal(
    webhookUrlFrom(req, {}),
    "https://authichain-telegram.example.workers.dev/api/telegram/webhook"
  );
  assert.equal(
    webhookUrlFrom(req, {
      TELEGRAM_WEBHOOK_URL: "https://hooks.example/telegram",
    }),
    "https://hooks.example/telegram"
  );
});
