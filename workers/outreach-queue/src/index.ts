/**
 * outreach-queue — AuthiChain async outreach job queue worker
 * Queues and processes lead outreach jobs via Cloudflare Queues
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

interface QueueMessage<T> {
  id: string;
  body: T;
  timestamp: Date;
  ack(): void;
  retry(): void;
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.INTERNAL_SECRET) return false
  const header = request.headers.get('X-Internal-Secret') ?? ''
  const enc = new TextEncoder()
  const a = enc.encode(header)
  const b = enc.encode(env.INTERNAL_SECRET)
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

async function enqueueJob(request: Request, env: Env): Promise<Response> {
  const job = await request.json<Omit<OutreachJob, 'id'>>();

  if (!job.to || !job.subject || !job.body) {
    return Response.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const outreachJob: OutreachJob = {
    id,
    retryCount: 0,
    scheduledAt: Date.now(),
    ...job,
  };

  await env.OUTREACH_QUEUE.send(outreachJob);
  await env.OUTREACH_KV.put(`job:${id}`, JSON.stringify({ ...outreachJob, status: 'queued' }), {
    expirationTtl: 86400 * 7, // 7-day TTL
  });

  return Response.json({ jobId: id, status: 'queued' }, { status: 202 });
}

async function getJobStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const jobId = url.pathname.split('/').pop();
  if (!jobId) return Response.json({ error: 'Missing job ID' }, { status: 400 });

  const raw = await env.OUTREACH_KV.get(`job:${jobId}`);
  if (!raw) return Response.json({ error: 'Job not found' }, { status: 404 });

  return Response.json(JSON.parse(raw));
}

async function processJob(job: OutreachJob, env: Env): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Internal-Secret',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    let response: Response;

    if (request.method === 'POST' && url.pathname === '/queue/enqueue') {
      if (!isAuthorized(request, env)) {
        response = Response.json({ error: 'Unauthorized' }, { status: 401 });
      } else {
        response = await enqueueJob(request, env);
      }
    } else if (request.method === 'GET' && url.pathname.startsWith('/queue/status/')) {
      if (!isAuthorized(request, env)) {
        response = Response.json({ error: 'Unauthorized' }, { status: 401 });
      } else {
        response = await getJobStatus(request, env);
      }
    } else {
      response = Response.json({ error: 'Not found' }, { status: 404 });
    }

    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },

  async queue(batch: MessageBatch<OutreachJob>, env: Env): Promise<void> {
    for (const message of batch.messages as QueueMessage<OutreachJob>[]) {
      const job = message.body;
      const success = await processJob(job, env);

      if (success) {
        await env.OUTREACH_KV.put(
          `job:${job.id}`,
          JSON.stringify({ ...job, status: 'sent', sentAt: Date.now() }),
          { expirationTtl: 86400 * 7 }
        );
        message.ack();
      } else {
        const retryCount = (job.retryCount ?? 0) + 1;
        if (retryCount >= 3) {
          await env.OUTREACH_KV.put(
            `job:${job.id}`,
            JSON.stringify({ ...job, status: 'failed', retryCount }),
            { expirationTtl: 86400 * 7 }
          );
          message.ack(); // Exhaust retries — mark as failed
        } else {
          await env.OUTREACH_KV.put(
            `job:${job.id}`,
            JSON.stringify({ ...job, status: 'retrying', retryCount }),
            { expirationTtl: 86400 * 7 }
          );
          message.retry();
        }
      }
    }
  },
};
