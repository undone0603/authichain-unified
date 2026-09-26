/**
 * outreach-queue — AuthiChain async outreach job queue worker
 * Queues and processes lead outreach jobs via Cloudflare Queues
 *
 * One email per recipient, ever. Every address this worker has emailed is kept
 * in OUTREACH_KV under `sent:<address>` with no expiry. A job for an address
 * already there is refused at enqueue (409) and skipped at send time, so a
 * repeated POST, a queue redelivery or a second caller cannot email the same
 * person twice. The September 2026 repeats (inquiries@moo.com five times) are
 * what this prevents.
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
  const outreachJob: OutreachJob = {
    id,
    retryCount: 0,
    scheduledAt: Date.now(),
    ...job,
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

async function processJob(job: OutreachJob, env: Env): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.OUTREACH_FROM_EMAIL,
      to: [job.to],
      subject: job.subject,
      html: job.body,
    }),
  });

  return res.ok;
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
    for (const message of batch.messages) {
      const job = message.body;

      // Re-checked here as well as at enqueue: two jobs for one address can be
      // queued before either sends, and the queue can redeliver a message.
      if (await alreadyEmailed(env.OUTREACH_KV, job.to)) {
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({ ...job, status: "skipped_duplicate" }),
          { expirationTtl: 86400 * 7 }
        );
        message.ack();
        continue;
      }

      const success = await processJob(job, env);

      if (success) {
        // No TTL: the record of who was emailed must outlive the job log.
        await env.OUTREACH_KV.put(
          sentKey(job.to),
          JSON.stringify({
            jobId: job.id,
            subject: job.subject,
            sentAt: Date.now(),
          })
        );
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({ ...job, status: "sent", sentAt: Date.now() }),
          { expirationTtl: 86400 * 7 }
        );
        message.ack();
      } else {
        const retryCount = (job.retryCount ?? 0) + 1;
        if (retryCount >= 3) {
          await env.OUTREACH_KV.put(
            `job:${job.id}`,
            JSON.stringify({ ...job, status: "failed", retryCount }),
            { expirationTtl: 86400 * 7 }
          );
          message.ack(); // Exhaust retries — mark as failed
        } else {
          await env.OUTREACH_KV.put(
            `job:${job.id}`,
            JSON.stringify({ ...job, status: "retrying", retryCount }),
            { expirationTtl: 86400 * 7 }
          );
          message.retry();
        }
      }
    }
  },
};
