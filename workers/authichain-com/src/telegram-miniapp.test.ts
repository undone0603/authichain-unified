import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINIAPP_CANONICAL,
  MINIAPP_HEADERS,
  PASSPORT_CHECKOUT_PATH,
  PASSPORT_CHECKOUT_URL,
  isTelegramMiniAppPath,
  renderTelegramMiniApp,
  tryHandleTelegramMiniApp,
} from "./telegram-miniapp.ts";

function req(path: string) {
  return new Request(`https://authichain.com${path}`);
}

test("path helper recognizes Mini App aliases", () => {
  for (const p of ["/telegram", "/telegram/", "/miniapp", "/miniapp/"]) {
    assert.equal(isTelegramMiniAppPath(p), true, p);
  }
  assert.equal(isTelegramMiniAppPath("/pricing"), false);
  assert.equal(isTelegramMiniAppPath("/api/telegram"), false);
});

test("Mini App copy is Passport $49 AuthiChain, not the 2025 Inc deck", () => {
  const html = renderTelegramMiniApp();
  assert.match(html, /<title>StrainChain Passport \| AuthiChain<\/title>/);
  assert.match(html, new RegExp(`rel="canonical" href="${MINIAPP_CANONICAL}"`));
  assert.match(html, /noindex/);
  assert.equal(html.includes(`action="${PASSPORT_CHECKOUT_URL}"`), true);
  assert.equal(
    PASSPORT_CHECKOUT_PATH,
    "/api/checkout/plan/strainchain_passport"
  );
  assert.match(html, /name="email"/);
  assert.match(html, /Publish Passport — \$49/);
  assert.match(html, /href="https:\/\/authichain.com\/pricing"/);
  assert.match(html, /action="https:\/\/authichain.com\/verify"/);
  assert.match(html, /ZACHARY KIETZMAN/);
  assert.match(html, /telegram\.org\/js\/telegram-web-app\.js/);
  assert.doesNotMatch(html, /calendly/i);
  assert.doesNotMatch(html, /schedule a (call|demo)/i);
  assert.doesNotMatch(html, /AuthiChain Inc/i);
  assert.doesNotMatch(html, /Series A/i);
  assert.doesNotMatch(html, /\$8\s*M/i);
});

test("Mini App CSP allows Telegram WebView embed and script", () => {
  assert.match(MINIAPP_HEADERS["Content-Security-Policy"], /telegram\.org/);
  assert.match(MINIAPP_HEADERS["Content-Security-Policy"], /frame-ancestors/);
  assert.equal(MINIAPP_HEADERS["X-Frame-Options"], undefined);
});

test("tryHandleTelegramMiniApp serves aliases and ignores other paths", async () => {
  for (const path of ["/telegram", "/miniapp"]) {
    const res = tryHandleTelegramMiniApp(req(path));
    assert.ok(res, path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await res.text(), /Genetics passport in one checkout/);
  }
  assert.equal(tryHandleTelegramMiniApp(req("/pricing")), null);
  assert.equal(tryHandleTelegramMiniApp(req("/api/telegram")), null);
});
