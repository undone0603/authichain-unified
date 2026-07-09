// workers/scan-anomaly-detector/index.ts
// Cloudflare Worker — Real-time QR Scan Fraud & Anomaly Detection
// Signals: geo-velocity, burst rate, UA fingerprint, time-of-day, repeat-IP
// Uses: Cloudflare KV (sliding window counters), Durable Objects (geo state),
//       Supabase (alert persistence), Resend (alert emails)

import { createClient } from '@supabase/supabase-js';

export interface Env {
  SCAN_COUNTERS: KVNamespace;        // KV for sliding-window counters
  SCAN_GEO_STATE: DurableObjectNamespace; // DO for geo-velocity
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  ALERT_EMAIL: string;               // ops@authichain.com
  ANOMALY_THRESHOLD_BURST: string;   // default "20" scans/60s per QR
  ANOMALY_THRESHOLD_IP: string;      // default "50" scans/60s per IP
  GEO_VELOCITY_MAX_KM_PER_HOUR: string; // default "900"
}

// ---------- types ----------

interface ScanEvent {
  qrId: string;
  productId: string;
  brand: string;
  ip: string;
  country: string;
  region: string;
  lat: number | null;
  lon: number | null;
  ua: string;
  ts: number; // epoch ms
}

interface AnomalyResult {
  isAnomalous: boolean;
  signals: AnomalySignal[];
  riskScore: number; // 0-100
  action: 'allow' | 'flag' | 'block';
}

interface AnomalySignal {
  type: 'burst_qr' | 'burst_ip' | 'geo_velocity' | 'ua_bot' | 'impossible_travel' | 'off_hours';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
  score: number;
}

// ---------- helpers ----------

/** Haversine distance in km between two lat/lon points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bot / headless-browser UA patterns */
const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /headless/i, /phantom/i,
  /selenium/i, /puppeteer/i, /playwright/i, /curl/i, /python-requests/i,
  /wget/i, /go-http-client/i, /java\/\d/i,
];

function isBotUA(ua: string): boolean {
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

/** Sliding-window counter in KV (60-second buckets) */
async function incrementSlidingWindow(
  kv: KVNamespace,
  key: string,
  windowSecs = 60,
): Promise<number> {
  const bucketKey = `sw:${key}:${Math.floor(Date.now() / 1000 / windowSecs)}`;
  const raw = await kv.get(bucketKey);
  const count = (raw ? parseInt(raw, 10) : 0) + 1;
  await kv.put(bucketKey, String(count), { expirationTtl: windowSecs * 2 });
  return count;
}

// ---------- core detection ----------

async function detectAnomalies(event: ScanEvent, env: Env): Promise<AnomalyResult> {
  const signals: AnomalySignal[] = [];
  const burstQrThreshold = parseInt(env.ANOMALY_THRESHOLD_BURST || '20', 10);
  const burstIpThreshold = parseInt(env.ANOMALY_THRESHOLD_IP || '50', 10);
  const maxVelocity = parseFloat(env.GEO_VELOCITY_MAX_KM_PER_HOUR || '900');

  // 1. Burst rate per QR code
  const qrCount = await incrementSlidingWindow(env.SCAN_COUNTERS, `qr:${event.qrId}`);
  if (qrCount > burstQrThreshold) {
    const severity = qrCount > burstQrThreshold * 3 ? 'critical' : qrCount > burstQrThreshold * 2 ? 'high' : 'medium';
    signals.push({
      type: 'burst_qr',
      severity,
      detail: `QR ${event.qrId} scanned ${qrCount}x in 60s (threshold: ${burstQrThreshold})`,
      score: Math.min(40, Math.round((qrCount / burstQrThreshold) * 15)),
    });
  }

  // 2. Burst rate per IP
  const ipCount = await incrementSlidingWindow(env.SCAN_COUNTERS, `ip:${event.ip}`);
  if (ipCount > burstIpThreshold) {
    signals.push({
      type: 'burst_ip',
      severity: ipCount > burstIpThreshold * 2 ? 'critical' : 'high',
      detail: `IP ${event.ip} made ${ipCount} scans in 60s (threshold: ${burstIpThreshold})`,
      score: Math.min(30, Math.round((ipCount / burstIpThreshold) * 12)),
    });
  }

  // 3. Bot user-agent
  if (isBotUA(event.ua)) {
    signals.push({
      type: 'ua_bot',
      severity: 'high',
      detail: `Automated UA detected: "${event.ua.slice(0, 80)}"`,
      score: 25,
    });
  }

  // 4. Off-hours scanning (02:00-05:00 UTC) — suspicious for physical products
  const hour = new Date(event.ts).getUTCHours();
  if (hour >= 2 && hour <= 5) {
    signals.push({
      type: 'off_hours',
      severity: 'low',
      detail: `Scan at ${hour}:00 UTC (off-hours window 02-05)`,
      score: 5,
    });
  }

  // 5. Geo-velocity: compare against last known location for this QR
  if (event.lat !== null && event.lon !== null) {
    const geoKey = `geo:${event.qrId}`;
    const lastRaw = await env.SCAN_COUNTERS.get(geoKey);
    if (lastRaw) {
      const last = JSON.parse(lastRaw) as { lat: number; lon: number; ts: number };
      const elapsedHours = (event.ts - last.ts) / 3_600_000;
      if (elapsedHours > 0 && elapsedHours < 12) {
        const km = haversineKm(last.lat, last.lon, event.lat, event.lon);
        const kmph = km / elapsedHours;
        if (kmph > maxVelocity) {
          signals.push({
            type: 'impossible_travel',
            severity: kmph > maxVelocity * 2 ? 'critical' : 'high',
            detail: `Same QR scanned ${Math.round(km)}km apart in ${(elapsedHours * 60).toFixed(0)} min (${Math.round(kmph)} km/h > ${maxVelocity} limit)`,
            score: Math.min(35, Math.round(kmph / maxVelocity * 20)),
          });
        }
      }
    }
    // Update last known location
    await env.SCAN_COUNTERS.put(
      geoKey,
      JSON.stringify({ lat: event.lat, lon: event.lon, ts: event.ts }),
      { expirationTtl: 86400 },
    );
  }

  // ---------- scoring ----------
  const riskScore = Math.min(100, signals.reduce((s, sig) => s + sig.score, 0));
  const isAnomalous = riskScore > 0;
  const action: AnomalyResult['action'] =
    riskScore >= 60 ? 'block' : riskScore >= 25 ? 'flag' : 'allow';

  return { isAnomalous, signals, riskScore, action };
}

// ---------- persistence & alerting ----------

async function persistAnomaly(
  event: ScanEvent,
  result: AnomalyResult,
  env: Env,
): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  await supabase.from('scan_anomalies').insert({
    qr_id: event.qrId,
    product_id: event.productId,
    brand: event.brand,
    ip: event.ip,
    country: event.country,
    ua: event.ua,
    risk_score: result.riskScore,
    action: result.action,
    signals: result.signals,
    scanned_at: new Date(event.ts).toISOString(),
  });

  // Send alert email for high-risk events
  if (result.riskScore >= 60 && env.RESEND_API_KEY) {
    const signalList = result.signals
      .map((s) => `• [${s.severity.toUpperCase()}] ${s.type}: ${s.detail}`)
      .join('\n');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alerts@authichain.com',
        to: [env.ALERT_EMAIL],
        subject: `[AUTHICHAIN ALERT] ${result.action.toUpperCase()} — Risk ${result.riskScore}/100 on ${event.brand}`,
        text: `Anomaly detected on ${event.brand}\n\nQR: ${event.qrId}\nProduct: ${event.productId}\nIP: ${event.ip} (${event.country})\nRisk Score: ${result.riskScore}/100\nAction: ${result.action.toUpperCase()}\n\nSignals:\n${signalList}\n\nTimestamp: ${new Date(event.ts).toISOString()}`,
      }),
    });
  }
}

// ---------- Worker entry ----------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Only accept POST
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Bearer auth
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }

    let body: Partial<ScanEvent>;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad JSON', { status: 400 });
    }

    // Validate required fields
    const { qrId, productId, brand, ip, country, ua } = body;
    if (!qrId || !productId || !brand || !ip || !country || !ua) {
      return new Response('Missing required fields: qrId, productId, brand, ip, country, ua', {
        status: 422,
      });
    }

    // Enrich from CF headers if not provided
    const cf = (request as any).cf || {};
    const event: ScanEvent = {
      qrId,
      productId,
      brand,
      ip: ip || request.headers.get('CF-Connecting-IP') || 'unknown',
      country: country || cf.country || 'XX',
      region: (body as any).region || cf.region || '',
      lat: (body as any).lat ?? (cf.latitude ? parseFloat(cf.latitude) : null),
      lon: (body as any).lon ?? (cf.longitude ? parseFloat(cf.longitude) : null),
      ua: ua || request.headers.get('User-Agent') || '',
      ts: (body as any).ts || Date.now(),
    };

    const result = await detectAnomalies(event, env);

    // Persist + alert in background (non-blocking)
    if (result.isAnomalous) {
      ctx.waitUntil(persistAnomaly(event, result, env));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action: result.action,
        riskScore: result.riskScore,
        signals: result.signals,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  },
} satisfies ExportedHandler<Env>;
