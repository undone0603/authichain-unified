/**
 * outreach-queue — AuthiChain async outreach job queue worker
 * Queues and processes lead outreach jobs via Cloudflare Queues
 *
 * One email per recipient, ever. Three layers, because no single one is enough:
 *
 * 1. OUTREACH_KV `sent:<address>` (no expiry). Refuses the job at enqueue (409)
 *    and skips it at send time. KV is eventually consistent, so on its own it
 *    cannot stop two consumers that read "not sent" at the same moment, or a
 *    redelivery after a send whose KV write failed.
 * 2. Resend `Idempotency-Key` derived from the recipient. Resend keeps keys for
 *    24 hours across every isolate and colo: the same payload returns the
 *    original result without sending, a different payload gets 409
 *    `invalid_idempotent_request`. Either way nothing is sent twice.
 * 3. A per-batch set, so two jobs for one address in the same batch never both
 *    reach Resend.
 *
 * The September 2026 repeats (inquiries@moo.com five times) are what this
 * prevents.
 */

export interface Env {
  OUTREACH_QUEUE: Queue;
  OUTREACH_KV: KVNamespace;
  RESEND_API_KEY: string;
  OUTREACH_FROM_EMAIL: string;
  INTERNAL_SECRET: string;
}

interface OutreachJob {
  id: string;
  to: string;
  subject: string;
  body: string;
  leadSource: string;
  retryCount?: number;
  scheduledAt?: number;
}

export function normalizeRecipient(email: string): string {
  return email.trim().toLowerCase();
}

export function sentKey(email: string): string {
  return `sent:${normalizeRecipient(email)}`;
}

/** Attempts before a failing job is marked failed (Queues' default max_retries is 3). */
export const MAX_ATTEMPTS = 3;

/**
 * Resend idempotency key for a recipient. Hashed so the address itself is not
 * sent as a header; stable across jobs so a second job for the same person is
 * refused by Resend even when KV has not caught up.
 */
export async function recipientIdempotencyKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizeRecipient(email))
  );
  const hex = [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return `outreach-recipient-${hex}`;
}

export async function alreadyEmailed(
  kv: KVNamespace,
  email: string
): Promise<boolean> {
  return (await kv.get(sentKey(email))) !== null;
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.INTERNAL_SECRET) return false;
  const header = request.headers.get("X-Internal-Secret") ?? "";
  const enc = new TextEncoder();
  const a = enc.encode(header);
  const b = enc.encode(env.INTERNAL_SECRET);
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

async function enqueueJob(request: Request, env: Env): Promise<Response> {
  const job = await request.json<Omit<OutreachJob, "id">>();

  if (!job.to || !job.subject || !job.body) {
    return Response.json(
      { error: "Missing required fields: to, subject, body" },
      { status: 400 }
    );
  }

  if (await alreadyEmailed(env.OUTREACH_KV, job.to)) {
    return Response.json(
      { error: "already_emailed", to: normalizeRecipient(job.to) },
      { status: 409 }
    );
  }

  const id = crypto.randomUUID();
  // The id is always ours: a caller-supplied `id` must not overwrite it.
  const outreachJob: OutreachJob = {
    ...job,
    id,
    retryCount: 0,
    scheduledAt: Date.now(),
  };

  await env.OUTREACH_QUEUE.send(outreachJob);
  await env.OUTREACH_KV.put(
    `job:${id}`,
    JSON.stringify({ ...outreachJob, status: "queued" }),
    {
      expirationTtl: 86400 * 7, // 7-day TTL
    }
  );

  return Response.json({ jobId: id, status: "queued" }, { status: 202 });
}

async function getJobStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.pathname.split("/").pop();
  if (!jobId)
    return Response.json({ error: "Missing job ID" }, { status: 400 });

  const raw = await env.OUTREACH_KV.get(`job:${jobId}`);
  if (!raw) return Response.json({ error: "Job not found" }, { status: 404 });

  return Response.json(JSON.parse(raw));
}

type SendResult = "sent" | "duplicate" | "failed";

async function processJob(job: OutreachJob, env: Env): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": await recipientIdempotencyKey(job.to),
    },
    body: JSON.stringify({
      from: env.OUTREACH_FROM_EMAIL,
      to: [job.to],
      subject: job.subject,
      html: job.body,
    }),
  });

  if (res.ok) return "sent";
  if (res.status === 409) {
    // invalid_idempotent_request: this recipient was already sent a different
    // email under the same key. concurrent_idempotent_requests: another
    // consumer is sending to them right now. Neither may send again.
    const body = (await res.json().catch(() => null)) as {
      name?: string;
    } | null;
    if (body?.name?.includes("idempotent")) return "duplicate";
  }
  return "failed";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Internal-Secret",
    };

    if (request.method === "OPTIONS")
      return new Response(null, { headers: corsHeaders });

    let response: Response;

    if (request.method === "POST" && url.pathname === "/queue/enqueue") {
      if (!isAuthorized(request, env)) {
        response = Response.json({ error: "Unauthorized" }, { status: 401 });
      } else {
        response = await enqueueJob(request, env);
      }
    } else if (
      request.method === "GET" &&
      url.pathname.startsWith("/queue/status/")
    ) {
      if (!isAuthorized(request, env)) {
        response = Response.json({ error: "Unauthorized" }, { status: 401 });
      } else {
        response = await getJobStatus(request, env);
      }
    } else {
      response = Response.json({ error: "Not found" }, { status: 404 });
    }

    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },

  async queue(batch: MessageBatch<OutreachJob>, env: Env): Promise<void> {
    const seenThisBatch = new Set<string>();
    for (const message of batch.messages) {
      const job = message.body;
      const recipient = normalizeRecipient(job.to);

      // Re-checked here as well as at enqueue: two jobs for one address can be
      // queued before either sends, and the queue can redeliver a message.
      if (
        seenThisBatch.has(recipient) ||
        (await alreadyEmailed(env.OUTREACH_KV, job.to))
      ) {
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({ ...job, status: "skipped_duplicate" }),
          { expirationTtl: 86400 * 7 }
        );
        message.ack();
        continue;
      }
      seenThisBatch.add(recipient);

      const result = await processJob(job, env);

      if (result === "sent" || result === "duplicate") {
        // No TTL: the record of who was emailed must outlive the job log.
        // A Resend-side duplicate is recorded too, so enqueue refuses the
        // address from now on.
        await env.OUTREACH_KV.put(
          sentKey(job.to),
          JSON.stringify({
            jobId: job.id,
            subject: job.subject,
            sentAt: Date.now(),
            ...(result === "duplicate" ? { via: "resend_idempotency" } : {}),
          })
        );
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({
            ...job,
            status: result === "sent" ? "sent" : "skipped_duplicate",
            sentAt: Date.now(),
          }),
          { expirationTtl: 86400 * 7 }
        );
        message.ack();
        continue;
      }

      // `retryCount` on the body never changes between deliveries, so it
      // cannot count retries. The queue's own attempt counter can.
      const attempts = message.attempts ?? 1;
      if (attempts >= MAX_ATTEMPTS) {
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({ ...job, status: "failed", retryCount: attempts }),
          { expirationTtl: 86400 * 7 }
        );
        message.ack(); // Exhaust retries — mark as failed
      } else {
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({ ...job, status: "retrying", retryCount: attempts }),
          { expirationTtl: 86400 * 7 }
        );
        message.retry();
      }
    }
  },
};
