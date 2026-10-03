import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index";
import {
  LAUNCH_WEEK_1,
  LW1_HEADLINE,
  LW1_NO_AFFILIATION,
  LW1_SUBLINE,
  launchWeek1Rows,
  launchWeek1Section,
} from "./launch-week-1";

type Env = Parameters<typeof worker.fetch>[1];
const ENV = { APP_WORKER: { fetch: async () => new Response("app") } } as unknown as Env;

const ON = { show: true, day1Live: true, day2Live: false, leadFormLive: false, day4Live: false };

test("defaults are the conservative text and the section is off", () => {
  assert.deepEqual(LAUNCH_WEEK_1, { show: false, day1Live: true, day2Live: false, leadFormLive: false, day4Live: false });
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
    "Digital Product Passport tooling, one piece a day as it ships, starting with an open-source verifier. Then a Friday recap."
  );
  const html = launchWeek1Section(ON);
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "";
  // Same text; the dates are wrapped in a nowrap span.
  assert.equal(h2, 'Launch Week #1: <span class="lw1-nowrap">Oct 12–16</span>');
  assert.ok(html.includes(LW1_SUBLINE));
  assert.ok(html.includes(`<p class="lw1-affiliation">${LW1_NO_AFFILIATION}</p>`));
  assert.match(html, /\.lw1-affiliation \{[^}]*color: #64748b;[^}]*font-size: 13px;[^}]*text-align: left;/);
});

test("the no-affiliation line is absent while show is off", () => {
  const html = launchWeek1Section({ ...ON, show: false });
  assert.equal(html, "");
  assert.doesNotMatch(html, /lw1-affiliation|AuthiChain is an independent brand/);
});

test("conservative rows: Monday is live; Tue, Wed and Thu read (planned); no links", () => {
  const rows = launchWeek1Rows(ON);
  assert.deepEqual(
    rows.map(r => [r.day, r.label, r.planned, r.href ?? null]),
    [
      ["Mon", "Open verifier", false, null],
      ["Tue", "A place for agents to ask", true, null],
      ["Wed", "Talk to us", true, null],
      ["Thu", "Battery passport gap check", true, null],
      ["Fri", "The recap", false, null],
    ]
  );
  const html = launchWeek1Section(ON);
  assert.doesNotMatch(html, /href=/);
  assert.equal((html.match(/\(planned\)/g) ?? []).length, 3);
});

test("day 2 live drops Tuesday's (planned)", () => {
  const html = launchWeek1Section({ ...ON, day2Live: true });
  assert.match(html, /A place for agents to ask<\/span><\/li>/);
  assert.doesNotMatch(html, /A place for agents to ask <span class="lw1-planned">\(planned\)<\/span>/);
});

test("day 4 live drops Thursday's (planned)", () => {
  const html = launchWeek1Section({ ...ON, day4Live: true });
  assert.match(html, /Battery passport gap check<\/span><\/li>/);
  assert.doesNotMatch(html, /Battery passport gap check <span class="lw1-planned">\(planned\)<\/span>/);
});

test("ship swaps: Day 1 live drops Monday's (planned); lead form live links Wednesday to /contact", () => {
  const html = launchWeek1Section({ show: true, day1Live: true, day2Live: false, leadFormLive: true, day4Live: true });
  assert.match(html, /Mon<\/span>[^\n]*Open verifier<\/span><\/li>/);
  assert.match(html, /<a href="\/contact">Talk to us<\/a><\/span><\/li>/);
  assert.match(html, /A place for agents to ask <span class="lw1-planned">\(planned\)<\/span>/);
  assert.equal((html.match(/href="/g) ?? []).length, 1);
});

test("the section ships no scripts and no external assets", () => {
  const html = launchWeek1Section({ show: true, day1Live: true, day2Live: false, leadFormLive: true, day4Live: true });
  assert.doesNotMatch(html, /<script|<link|<img|https?:\/\//i);
  assert.doesNotMatch(html, /tailwind|iconify|petite-vue/i);
});
