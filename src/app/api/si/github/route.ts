import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import {
  maxGitHubPayloadBytes,
  normalizeGitHubWebhook,
  verifyGitHubSignature,
} from '../../../../lib/si-github-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function readBoundedBody(request: NextRequest): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxGitHubPayloadBytes()) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: NextRequest) {
  const secret = process.env.SI_GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'GitHub ingestion is not configured' }, { status: 503 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maxGitHubPayloadBytes()) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const body = await readBoundedBody(request);
  if (!body) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  if (
    !verifyGitHubSignature(body, request.headers.get('x-hub-signature-256'), secret)
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = normalizeGitHubWebhook(
    request.headers.get('x-github-event'),
    payload
  );
  if (!event) return NextResponse.json({ accepted: false, reason: 'unsupported_event' });

  const deliveryId = request.headers.get('x-github-delivery');
  if (!deliveryId || !/^[A-Za-z0-9-]{1,100}$/.test(deliveryId)) {
    return NextResponse.json({ error: 'Invalid delivery identifier' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { error: deliveryError } = await admin
      .from('si_feed_webhook_deliveries')
      .insert({ delivery_id: deliveryId });

    if (deliveryError?.code === '23505') {
      return NextResponse.json({ accepted: true, duplicate: true }, { status: 202 });
    }
    if (deliveryError) throw deliveryError;

    const { error: logError } = await admin.from('automation_logs').insert({
      workflow_name: event.workflowName,
      trigger_type: 'webhook',
      status: event.status,
    });
    if (logError) {
      await admin
        .from('si_feed_webhook_deliveries')
        .delete()
        .eq('delivery_id', deliveryId);
      throw logError;
    }
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Unable to record GitHub event' }, { status: 503 });
  }
}
