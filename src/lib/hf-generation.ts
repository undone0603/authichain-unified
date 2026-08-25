import QRCode from 'qrcode';
import { validateQRScannability } from './vision';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Artistic backgrounds come from the qron-image-gen worker (Cloudflare Workers AI).
// The previous implementation called HuggingFace's hf-inference ControlNet endpoint,
// which no longer hosts the model (410 deprecated).
const QRON_WORKER_URL =
  process.env.QRON_WORKER_URL || 'https://qron-image-gen.undone-k.workers.dev';

const CANVAS_SIZE = 1024;
// QR share of the canvas per attempt; grows when the vision guardrail can't decode
const QR_SCALE_STEPS = [0.52, 0.64, 0.78];

type JimpImage = {
  bitmap: { width: number; height: number };
  cover(opts: { w: number; h: number }): JimpImage;
  resize(opts: { w: number; h: number }): JimpImage;
  composite(src: JimpImage, x: number, y: number): JimpImage;
  getBuffer(mime: 'image/png'): Promise<Buffer>;
};

async function loadJimp() {
  // Dynamic import for jimp to handle ESM issues in Next.js/Turbopack (same as vision.ts)
  const mod = (await import('jimp')) as unknown as {
    Jimp: {
      read(buffer: Buffer): Promise<JimpImage>;
      new (opts: { width: number; height: number; color: number }): JimpImage;
    };
  };
  if (!mod.Jimp) throw new Error('Jimp failed to load properly');
  return mod.Jimp;
}

/** Fetches an AI art background from the qron-image-gen worker; null on any failure. */
async function fetchArtBackground(prompt: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${QRON_WORKER_URL}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // style 'raw' matches no worker preset, so the prompt is used verbatim
      body: JSON.stringify({ prompt: prompt.slice(0, 1800), style: 'raw' }),
      signal: AbortSignal.timeout(75_000),
    });
    if (!res.ok) {
      console.warn(`[HF-Gen] Art worker returned ${res.status}; using fallback background`);
      return null;
    }
    const data = (await res.json()) as { downloadUrl?: string };
    const base64 = data.downloadUrl?.split(';base64,')[1];
    if (!base64) return null;
    return Buffer.from(base64, 'base64');
  } catch (err) {
    console.warn('[HF-Gen] Art worker unreachable; using fallback background', err);
    return null;
  }
}

/**
 * Generates a "Living QR": an AI art background with a genuine, scannable QR
 * composited on top. Includes the "Vision Guardrail" — the result is decoded
 * with jsQR before delivery, and the QR is enlarged on retry if it fails.
 *
 * qr_weight/start_step are legacy ControlNet parameters kept for call-site
 * compatibility; they no longer influence generation.
 */
export async function generateLivingQR({
  url,
  prompt,
  negative_prompt: _negative_prompt,
  qr_weight: _qr_weight,
  start_step: _start_step,
  max_retries = 2,
}: {
  url: string;
  prompt: string;
  negative_prompt?: string;
  qr_weight?: number;
  start_step?: number;
  max_retries?: number;
}) {
  const Jimp = await loadJimp();

  // 1. Artistic background (worker), or a solid dark canvas if unavailable
  const artBuffer = await fetchArtBackground(prompt);
  const background = artBuffer
    ? (await Jimp.read(artBuffer)).cover({ w: CANVAS_SIZE, h: CANVAS_SIZE })
    : new Jimp({ width: CANVAS_SIZE, height: CANVAS_SIZE, color: 0x0b0b12ff });

  let attempt = 0;
  let finalBuffer: Buffer | null = null;
  let isVerified = false;

  while (attempt <= max_retries && !isVerified) {
    const scale = QR_SCALE_STEPS[Math.min(attempt, QR_SCALE_STEPS.length - 1)];
    const qrSize = Math.round(CANVAS_SIZE * scale);
    console.log(`[HF-Gen] Attempt ${attempt + 1}: QR size ${qrSize}px`);

    // 2. Render the QR at target size; margin 4 modules gives it its own quiet zone
    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      margin: 4,
      width: qrSize,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // 3. Composite the QR centered on the background
    const qrImage = (await Jimp.read(qrBuffer)).resize({ w: qrSize, h: qrSize });
    const canvas = (await Jimp.read(await background.getBuffer('image/png')))
      .composite(qrImage, Math.round((CANVAS_SIZE - qrSize) / 2), Math.round((CANVAS_SIZE - qrSize) / 2));
    finalBuffer = await canvas.getBuffer('image/png');

    // 4. Vision Check (Guardrail)
    const validation = await validateQRScannability(finalBuffer);
    if (validation.isScannable) {
      isVerified = true;
      console.log(`[HF-Gen] Validation Passed on attempt ${attempt + 1}`);
    } else {
      console.warn('[HF-Gen] Scannability Check Failed. Enlarging QR...');
      attempt++;
    }
  }

  if (!finalBuffer) throw new Error('Failed to generate image buffer');

  // 5. Upload to Supabase Storage (Permanent Hosting)
  const fileName = `generated/${crypto.randomUUID()}.png`;
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('qrons')
    .upload(fileName, finalBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload to Supabase: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from('qrons').getPublicUrl(fileName);

  return {
    imageUrl: publicUrl,
    fileName,
    storagePath: uploadData.path,
    scannable: isVerified,
    attempts: attempt + 1,
  };
}
