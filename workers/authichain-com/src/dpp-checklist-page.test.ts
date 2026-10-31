import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DPP_CHECKLIST_DISCLAIMER,
  DPP_CHECKLIST_ITEMS,
  isDppChecklistPath,
  renderDppChecklistPage,
  tryHandleDppChecklist,
} from "./dpp-checklist-page.ts";

const req = (p: string, method = "GET") =>
  new Request(`https://authichain.com${p}`, { method });

test("path helper matches /dpp-checklist only", () => {
  assert.equal(isDppChecklistPath("/dpp-checklist"), true);
  assert.equal(isDppChecklistPath("/dpp-checklist/"), true);
  assert.equal(isDppChecklistPath("/dpp-check"), false);
  assert.equal(isDppChecklistPath("/dpp"), false);
});

test("handler serves HTML for GET/HEAD and ignores other paths/methods", async () => {
  const r = tryHandleDppChecklist(req("/dpp-checklist"));
  assert.ok(r);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type") ?? "", /text\/html/);
  assert.match(await r.text(), /EU DPP Readiness Checklist/);
  assert.ok(tryHandleDppChecklist(req("/dpp-checklist", "HEAD")));
  assert.equal(tryHandleDppChecklist(req("/dpp-checklist", "POST")), null);
  assert.equal(tryHandleDppChecklist(req("/dpp-check")), null);
});

test("page carries every item, the disclaimer, noindex, and no price or checkout", () => {
  const html = renderDppChecklistPage();
  for (const i of DPP_CHECKLIST_ITEMS) assert.ok(html.includes(i), i);
  assert.ok(html.includes(DPP_CHECKLIST_DISCLAIMER));
  assert.match(html, /name="robots" content="noindex, follow"/);
  assert.match(html, /rel="canonical" href="https:\/\/authichain\.com\/dpp-checklist"/);
  assert.match(html, /href="\/dpp-check"/);
  assert.doesNotMatch(html, /\$\d/);
  // shared estate CSS has .checkout class names; assert no checkout link/form.
  assert.doesNotMatch(html, /(?:href|action)="[^"]*checkout/i);
});
