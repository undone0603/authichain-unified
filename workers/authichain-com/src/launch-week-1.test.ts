import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index";
import {
  LAUNCH_WEEK_1,
  LW1_HEADLINE,
  LW1_SUBLINE,
  launchWeek1Rows,
  launchWeek1Section,
} from "./launch-week-1";

type Env = Parameters<typeof worker.fetch>[1];
const ENV = { APP_WORKER: { fetch: async () => new Response("app") } } as unknown as Env;

const ON = { show: true, day1Live: false, leadFormLive: false };

test("defaults are the conservative text and the section is off", () => {
  assert.deepEqual(LAUNCH_WEEK_1, { show: false, day1Live: false, leadFormLive: false });
  assert.equal(launchWeek1Section(), "");
});

test("the homepage does not render Launch Week #1 while show is off", async () => {
  const res = await worker.fetch(new Request("https://authichain.com/"), ENV);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /Launch Week #1/);
  assert.doesNotMatch(html, /id="launch-week"/);
});

test("copy matches the announcement draft's Visual section", () => {
  assert.equal(LW1_HEADLINE, "Launch Week #1: Oct 12–16");
  assert.equal(
    LW1_SUBLINE,
    "Building the open-source Digital Product Passport, one working piece a day, then a Friday recap."
  );
  const html = launchWeek1Section(ON);
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "";
  // Same text; the dates are wrapped in a nowrap span.
  assert.equal(h2, 'Launch Week #1: <span class="lw1-nowrap">Oct 12–16</span>');
  assert.ok(html.includes(LW1_SUBLINE));
});

test("conservative rows: Mon, Tue and Wed read (planned); no links", () => {
  const rows = launchWeek1Rows(ON);
  assert.deepEqual(
    rows.map(r => [r.day, r.label, r.planned, r.href ?? null]),
    [
      ["Mon", "Open verifier", true, null],
      ["Tue", "A place for agents to ask", true, null],
      ["Wed", "Talk to us", true, null],
      ["Thu", "Battery passport gap check", false, null],
      ["Fri", "The recap", false, null],
    ]
  );
  const html = launchWeek1Section(ON);
  assert.doesNotMatch(html, /href=/);
  assert.equal((html.match(/\(planned\)/g) ?? []).length, 3);
});

test("ship swaps: Day 1 live drops Monday's (planned); lead form live links Wednesday to /contact", () => {
  const html = launchWeek1Section({ show: true, day1Live: true, leadFormLive: true });
  assert.match(html, /Mon<\/span>[^\n]*Open verifier<\/span><\/li>/);
  assert.match(html, /<a href="\/contact">Talk to us<\/a><\/span><\/li>/);
  assert.match(html, /A place for agents to ask <span class="lw1-planned">\(planned\)<\/span>/);
  assert.equal((html.match(/href="/g) ?? []).length, 1);
});

test("the section ships no scripts and no external assets", () => {
  const html = launchWeek1Section({ show: true, day1Live: true, leadFormLive: true });
  assert.doesNotMatch(html, /<script|<link|<img|https?:\/\//i);
  assert.doesNotMatch(html, /tailwind|iconify|petite-vue/i);
});
