import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  alreadyEmailed,
  MAX_ATTEMPTS,
  normalizeRecipient,
  recipientIdempotencyKey,
  sentKey,
} from "./index";

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
  } as any;
}

function makeEnv(kv = fakeKv()) {
  return {
    OUTREACH_KV: kv,
    OUTREACH_QUEUE: { send: vi.fn(async () => {}) },
    RESEND_API_KEY: "k",
    OUTREACH_FROM_EMAIL: "hello@authichain.com",
    INTERNAL_SECRET: "s",
  } as any;
}

function message(body: any, attempts?: number) {
  return { body, attempts, ack: vi.fn(), retry: vi.fn() };
}

const job = (id: string, to: string) => ({
  id,
  to,
  subject: "Hi",
  body: "<p>x</p>",
  leadSource: "test",
});

describe("outreach-queue dedup", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keys recipients case- and space-insensitively", () => {
    expect(normalizeRecipient("  Inquiries@MOO.com ")).toBe(
      "inquiries@moo.com"
    );
    expect(sentKey("Inquiries@MOO.com")).toBe("sent:inquiries@moo.com");
  });

  it("sends two jobs for one address only once, in one batch", async () => {
    const env = makeEnv();
    const a = message(job("1", "inquiries@moo.com"));
    const b = message(job("2", "INQUIRIES@moo.com"));
    await worker.queue({ messages: [a, b] } as any, env);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.ack).toHaveBeenCalled();
    expect(b.ack).toHaveBeenCalled();
    expect(JSON.parse(env.OUTREACH_KV.store.get("job:2")).status).toBe(
      "skipped_duplicate"
    );
    expect(await alreadyEmailed(env.OUTREACH_KV, "inquiries@moo.com")).toBe(
      true
    );
  });

  it("does not record a failed send as emailed", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const env = makeEnv();
    const m = message(job("1", "a@example.com"));
    await worker.queue({ messages: [m] } as any, env);
    expect(m.retry).toHaveBeenCalled();
    expect(await alreadyEmailed(env.OUTREACH_KV, "a@example.com")).toBe(false);
  });

  it("refuses to enqueue an address already emailed", async () => {
    const kv = fakeKv();
    kv.store.set("sent:a@example.com", "{}");
    const env = makeEnv(kv);
    const res = await worker.fetch(
      new Request("https://q/queue/enqueue", {
        method: "POST",
        headers: {
          "X-Internal-Secret": "s",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "A@example.com",
          subject: "Hi",
          body: "x",
          leadSource: "t",
        }),
      }),
      env
    );
    expect(res.status).toBe(409);
    expect(env.OUTREACH_QUEUE.send).not.toHaveBeenCalled();
  });

  it("enqueues a new address", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://q/queue/enqueue", {
        method: "POST",
        headers: {
          "X-Internal-Secret": "s",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: "new@example.com",
          subject: "Hi",
          body: "x",
          leadSource: "t",
        }),
      }),
      env
    );
    expect(res.status).toBe(202);
    expect(env.OUTREACH_QUEUE.send).toHaveBeenCalledTimes(1);
  });

  it("sends a recipient-derived Idempotency-Key, never the raw address", async () => {
    const env = makeEnv();
    await worker.queue({ messages: [message(job("1", " A@Example.com"))] } as any, env);
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    const key = headers["Idempotency-Key"];
    expect(key).toBe(await recipientIdempotencyKey("a@example.com"));
    expect(key).toMatch(/^outreach-recipient-[0-9a-f]{64}$/);
    expect(key).not.toContain("example.com");
  });

  it("treats a Resend idempotency 409 as already emailed, not as a failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ statusCode: 409, name: "invalid_idempotent_request" }),
        { status: 409 }
      )
    );
    const env = makeEnv();
    const m = message(job("1", "dup@example.com"));
    await worker.queue({ messages: [m] } as any, env);
    expect(m.ack).toHaveBeenCalled();
    expect(m.retry).not.toHaveBeenCalled();
    expect(await alreadyEmailed(env.OUTREACH_KV, "dup@example.com")).toBe(true);
    expect(JSON.parse(env.OUTREACH_KV.store.get("job:1")).status).toBe(
      "skipped_duplicate"
    );
  });

  it("does not treat an unrelated 409 as a duplicate", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ name: "something_else" }), { status: 409 })
    );
    const env = makeEnv();
    const m = message(job("1", "x@example.com"));
    await worker.queue({ messages: [m] } as any, env);
    expect(m.retry).toHaveBeenCalled();
    expect(await alreadyEmailed(env.OUTREACH_KV, "x@example.com")).toBe(false);
  });

  it("skips a same-batch duplicate even when KV has not caught up", async () => {
    const kv = fakeKv();
    kv.get = vi.fn(async () => null); // stale KV: never sees the first write
    const env = makeEnv(kv);
    const a = message(job("1", "same@example.com"));
    const b = message(job("2", "same@example.com"));
    await worker.queue({ messages: [a, b] } as any, env);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(kv.store.get("job:2")).status).toBe("skipped_duplicate");
  });

  it("stops retrying at MAX_ATTEMPTS using the queue's attempt count", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const env = makeEnv();
    const m = message(job("1", "f@example.com"), MAX_ATTEMPTS);
    await worker.queue({ messages: [m] } as any, env);
    expect(m.ack).toHaveBeenCalled();
    expect(m.retry).not.toHaveBeenCalled();
    expect(JSON.parse(env.OUTREACH_KV.store.get("job:1")).status).toBe("failed");
  });

  it("keeps the server-assigned job id when the caller sends one", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      new Request("https://q/queue/enqueue", {
        method: "POST",
        headers: {
          "X-Internal-Secret": "s",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "caller-chosen",
          to: "id@example.com",
          subject: "Hi",
          body: "x",
          leadSource: "t",
        }),
      }),
      env
    );
    const { jobId } = (await res.json()) as { jobId: string };
    expect(jobId).not.toBe("caller-chosen");
    expect(env.OUTREACH_QUEUE.send.mock.calls[0][0].id).toBe(jobId);
  });
});
