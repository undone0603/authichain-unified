// @vitest-environment node
import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import {
  registerResendInbound,
  verifyWebhookSignature,
  type ResendInboundEnv,
} from "./resend-inbound";

type Row = Record<string, unknown>;

const { tables, writes } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  writes: [] as Array<{ table: string; op: string; row: Row }>,
}));

// Minimal chainable stand-in for the Supabase query builder: filters with
// .eq(), returns the first match from .maybeSingle(), records writes.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let pending: { op: string; row: Row } | null = null;
      const rows = () =>
        (tables[table] ?? []).filter(r =>
          filters.every(([k, v]) => r[k] === v)
        );
      const builder: any = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq(key: string, value: unknown) {
          filters.push([key, value]);
          if (pending?.op === "update") {
            writes.push({ table, op: "update", row: pending.row });
            return Promise.resolve({ error: null });
          }
          return builder;
        },
        insert(row: Row) {
          pending = { op: "insert", row };
          writes.push({ table, op: "insert", row });
          return builder;
        },
        update(row: Row) {
          pending = { op: "update", row };
          return builder;
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        single: async () => ({ data: { id: "reply-1" }, error: null }),
      };
      return builder;
    },
  }),
}));

const SECRET = "whsec_" + Buffer.from("test-signing-key").toString("base64");

const env: ResendInboundEnv = {
  RESEND_WEBHOOK_SECRET: SECRET,
  RESEND_API_KEY: "re_test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

function sign(
  body: string,
  id = "msg_1",
  timestamp = Math.floor(Date.now() / 1000)
) {
  const key = Buffer.from(SECRET.slice("whsec_".length), "base64");
  const sig = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": String(timestamp),
    "svix-signature": `v1,${sig}`,
  };
}

function post(body: unknown, headers: Record<string, string>, bindings = env) {
  const app = new Hono<{ Bindings: ResendInboundEnv }>();
  registerResendInbound(app);
  return app.request(
    "/api/webhooks/resend-inbound",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
    bindings
  );
}

const receivedEvent = {
  type: "email.received",
  created_at: "2026-09-24T13:00:00Z",
  data: {
    email_id: "em_123",
    from: "Ada <ada@acme.com>",
    subject: "Re: Proposal for Acme",
    message_id: "<m1@acme.com>",
  },
};

let fetched: string[];

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  writes.length = 0;
  fetched = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      fetched.push(url);
      return new Response(
        JSON.stringify({
          object: "email",
          id: "em_123",
          from: "Ada <ada@acme.com>",
          subject: "Re: Proposal for Acme",
          text: "Thanks, this looks great. Can we set up a call next week?",
          html: null,
          headers: { "In-Reply-To": "<orig@authichain.com>" },
          message_id: "<m1@acme.com>",
          reply_to: null,
        }),
        { status: 200 }
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature and rejects a tampered body", () => {
    const body = '{"type":"email.received"}';
    const h = sign(body);
    const headers = {
      id: h["svix-id"],
      timestamp: h["svix-timestamp"],
      signature: h["svix-signature"],
    };
    expect(verifyWebhookSignature(SECRET, headers, body)).toBe(true);
    expect(verifyWebhookSignature(SECRET, headers, body + " ")).toBe(false);
  });

  it("rejects a timestamp outside the tolerance window", () => {
    const body = "{}";
    const old = Math.floor(Date.now() / 1000) - 3600;
    const h = sign(body, "msg_1", old);
    expect(
      verifyWebhookSignature(
        SECRET,
        {
          id: h["svix-id"],
          timestamp: h["svix-timestamp"],
          signature: h["svix-signature"],
        },
        body
      )
    ).toBe(false);
  });
});

describe("POST /api/webhooks/resend-inbound", () => {
  it("refuses everything when RESEND_WEBHOOK_SECRET is unset", async () => {
    const res = await post(receivedEvent, sign(JSON.stringify(receivedEvent)), {
      ...env,
      RESEND_WEBHOOK_SECRET: undefined,
    });
    expect(res.status).toBe(503);
  });

  it("rejects an unsigned request without touching the database", async () => {
    const res = await post(receivedEvent, {});
    expect(res.status).toBe(401);
    expect(writes).toHaveLength(0);
    expect(fetched).toHaveLength(0);
  });

  it("acknowledges other event types without processing them", async () => {
    const event = { type: "email.delivered", data: {} };
    const res = await post(event, sign(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(fetched).toHaveLength(0);
  });

  it("fetches the body, stores the reply and marks the matched lead", async () => {
    tables.leads = [{ id: 7, email: "ada@acme.com", repliesReceived: 2 }];
    tables.proposals = [{ id: "prop-1", lead_email: "ada@acme.com" }];

    const res = await post(receivedEvent, sign(JSON.stringify(receivedEvent)));
    expect(res.status).toBe(201);
    expect(fetched).toEqual(["https://api.resend.com/emails/receiving/em_123"]);

    const insert = writes.find(
      w => w.table === "inbound_replies" && w.op === "insert"
    );
    expect(insert?.row).toMatchObject({
      lead_id: 7,
      lead_email: "ada@acme.com",
      sender_name: "Ada",
      message_id: "<m1@acme.com>",
      proposal_match_id: "prop-1",
      match_confidence: 1,
    });
    expect((insert?.row.metadata as Row).inReplyTo).toBe(
      "<orig@authichain.com>"
    );

    const update = writes.find(w => w.table === "leads" && w.op === "update");
    expect(update?.row).toMatchObject({
      emailReplied: true,
      repliesReceived: 3,
    });
  });

  it("skips a message it has already stored", async () => {
    tables.inbound_replies = [{ id: "r0", message_id: "<m1@acme.com>" }];
    const res = await post(receivedEvent, sign(JSON.stringify(receivedEvent)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      skipped: true,
      reason: "Duplicate message ID",
    });
    expect(writes).toHaveLength(0);
  });
});
