import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chat,
  clip,
  config,
  htmlToText,
  stripThinking,
} from "../gemma/lib.mjs";
import {
  buildPrompt as copyPrompt,
  renderIssue,
} from "../gemma/copy-review.mjs";
import {
  SOURCE,
  TEMPLATES,
  extractTemplates,
} from "../gemma/outreach-review.mjs";
import { logTail, marker, pickRuns } from "../gemma/alert-triage.mjs";

function fakeFetch(status: number, payload: unknown) {
  const calls: Array<{ url: string; body: any }> = [];
  const impl = async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(payload), { status });
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

describe("gemma client", () => {
  it("defaults to the owner's LM Studio and trims a trailing slash", () => {
    expect(config({}).url).toBe("http://192.168.254.10:1234");
    expect(config({}).model).toBe("google/gemma-4-e4b");
    expect(config({ LOCAL_LLM_URL: "http://x:1/" }).url).toBe("http://x:1");
    expect(config({ GEMMA_DRY_RUN: "true" }).dry).toBe(true);
  });

  it("calls the OpenAI-compatible endpoint and strips thinking", async () => {
    const f = fakeFetch(200, {
      choices: [{ message: { content: "<think>hmm</think> Answer" } }],
    });
    const out = await chat({
      url: "http://llm",
      model: "m",
      system: "s",
      user: "u",
      fetchImpl: f.impl,
    });
    expect(out).toBe("Answer");
    expect(f.calls[0].url).toBe("http://llm/v1/chat/completions");
    expect(f.calls[0].body.model).toBe("m");
    expect(f.calls[0].body.messages.map((m: any) => m.role)).toEqual([
      "system",
      "user",
    ]);
  });

  it("fails loudly on an error or an empty answer", async () => {
    await expect(
      chat({
        url: "u",
        model: "m",
        system: "",
        user: "",
        fetchImpl: fakeFetch(500, {}).impl,
      })
    ).rejects.toThrow(/Gemma 500/);
    await expect(
      chat({
        url: "u",
        model: "m",
        system: "",
        user: "",
        fetchImpl: fakeFetch(200, {
          choices: [{ message: { content: "<think>x</think>" } }],
        }).impl,
      })
    ).rejects.toThrow(/empty/);
  });

  it("reduces HTML to visible text", () => {
    const html =
      "<html><style>.a{}</style><script>alert(1)</script><h1>Buy &amp; save</h1><p>Only&nbsp;$29</p></html>";
    expect(htmlToText(html)).toBe("Buy & save Only $29");
    expect(htmlToText("x".repeat(50), 10)).toBe("xxxxxxxxxx\n[truncated]");
  });

  it("clips and strips safely on empty input", () => {
    expect(clip(undefined, 5)).toBe("");
    expect(stripThinking(null)).toBe("");
  });
});

describe("copy review", () => {
  it("builds a prompt that quotes the page and asks for three parts", () => {
    const p = copyPrompt({ name: "pricing", url: "https://x" }, "Starter $29");
    expect(p).toContain("Starter $29");
    expect(p).toContain("A/B test");
  });

  it("renders one dated issue body with the footer", () => {
    const body = renderIssue(["## a"], new Date("2026-09-23T00:00:00Z"));
    expect(body.startsWith("Updated 2026-09-23.")).toBe(true);
    expect(body).toContain("Suggestions only");
  });
});

describe("outreach review", () => {
  it("extracts every template from the real outreach script", () => {
    const templates = extractTemplates(readFileSync(SOURCE, "utf8"));
    expect(Object.keys(templates).sort()).toEqual([...TEMPLATES].sort());
    for (const [name, src] of Object.entries(templates)) {
      expect(src.startsWith(`function ${name}(`)).toBe(true);
      expect(src).not.toContain("\nfunction ");
    }
  });
});

describe("alert triage", () => {
  const now = Date.parse("2026-09-23T12:00:00Z");
  const run = (
    id: number,
    wf: number,
    conclusion: string,
    hoursAgo: number
  ) => ({
    id,
    workflow_id: wf,
    conclusion,
    created_at: new Date(now - hoursAgo * 3_600_000).toISOString(),
  });

  it("takes the newest failure per workflow inside the window", () => {
    const picked = pickRuns(
      [
        run(1, 10, "failure", 1),
        run(2, 10, "failure", 2),
        run(3, 11, "success", 1),
        run(4, 12, "failure", 30),
        run(5, 13, "failure", 3),
      ],
      { now }
    );
    expect(picked.map(r => r.id)).toEqual([1, 5]);
  });

  it("caps the number of runs", () => {
    const runs = [1, 2, 3, 4, 5].map(i => run(i, i, "failure", 1));
    expect(pickRuns(runs, { now, max: 2 })).toHaveLength(2);
  });

  it("keeps the log tail and marks comments per run", () => {
    const log = Array.from({ length: 300 }, (_, i) => `line ${i}`).join("\n");
    const tail = logTail(log, 5);
    expect(tail.split("\n")).toEqual([
      "line 295",
      "line 296",
      "line 297",
      "line 298",
      "line 299",
    ]);
    expect(marker(42)).toBe("<!-- gemma-triage:42 -->");
  });
});
