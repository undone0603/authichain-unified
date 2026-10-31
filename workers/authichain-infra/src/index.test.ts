// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { alertSignature } from "./index";

function memoryKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  };
}

/** Every probe answers as expected except govchain.us/opportunities (503). */
function stubFetch(pushes: { url: string; title: string | null; body: string }[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.startsWith("https://ntfy.sh/")) {
        const h = new Headers(init?.headers);
        pushes.push({ url, title: h.get("Title"), body: String(init?.body) });
        return new Response("ok");
      }
      if (url.includes("__pulse_missing__")) return new Response("", { status: 404 });
      if (url === "https://govchain.us/opportunities") return new Response("", { status: 503 });
      return new Response("", { status: 200 });
    })
  );
}

async function runCron(env: Record<string, unknown>) {
  const waits: Promise<unknown>[] = [];
  await worker.scheduled({} as never, env as never, { waitUntil: (p: Promise<unknown>) => waits.push(p) } as never);
  await Promise.all(waits);
}

afterEach(() => vi.unstubAllGlobals());

describe("alertSignature", () => {
  it("distinguishes problem sets that the old length-based key could not", () => {
    const a = alertSignature([{ name: "qron.space", status: "down" }]);
    const b = alertSignature([{ name: "govchain.us", status: "down" }]);
    expect(a).not.toBe(b);
    expect(alertSignature([{ name: "x", status: "warn" }, { name: "y", status: "down" }])).toBe(
      alertSignature([{ name: "y", status: "down" }, { name: "x", status: "warn" }])
    );
  });
});

describe("hourly run", () => {
  it(
    "pushes one ntfy alert for a down site, not again while unchanged, and reports it in KV",
    async () => {
      const pushes: { url: string; title: string | null; body: string }[] = [];
      stubFetch(pushes);
      const kv = memoryKv();
      const env = { INFRA_KV: kv, NTFY_URL: "https://ntfy.sh/test-topic", ALERT_EMAIL: "x" };
      await runCron(env);
      expect(pushes).toHaveLength(1);
      expect(pushes[0].title).toBe("AuthiChain: 1 down");
      expect(pushes[0].body).toContain("govchain.us opportunities: HTTP 503");
      const report = JSON.parse(kv.store.get("latest_report")!);
      expect(report.alertsSent).toEqual(["ntfy"]);
      expect(report.checks.find((c: { name: string }) => c.name === "github-actions").status).toBe("skip");

      await runCron(env);
      expect(pushes).toHaveLength(1);
    },
    40_000
  );

  it(
    "does not remember an alert it could not deliver",
    async () => {
      stubFetch([]);
      const kv = memoryKv();
      await runCron({ INFRA_KV: kv, ALERT_EMAIL: "x" });
      expect(kv.store.has("last_alert_hash")).toBe(false);
      expect(JSON.parse(kv.store.get("latest_report")!).alertsSent).toEqual([]);
    },
    40_000
  );
});
