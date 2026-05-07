import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { validateQRScannability } from './vision';

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
const HF_MODEL = 'DionTimmer/controlnet_qrcode-control_v1p_sd15';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

/**
 * Generates a "Living QR" using Hugging Face Inference APIs.
 * Replaces fal.ai dependency for Phase 3.
 * Includes "Vision Guardrail" for scannability.
 */
export async function generateLivingQR({
  url,
  prompt,
  negative_prompt = 'ugly, disfigured, low quality, blurry, nsfw',
  qr_weight = 1.35,
  start_step = 0.35,
  max_retries = 2,
}: {
  url: string;
  prompt: string;
  negative_prompt?: string;
  qr_weight?: number;
  start_step?: number;
  max_retries?: number;
}) {
  if (!HF_TOKEN) {
    throw new Error('HUGGINGFACE_TOKEN is missing');
  }

  // 1. Generate high-res QR code buffer
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: 768,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });

  const qrBase64 = qrBuffer.toString('base64');

  let currentQrWeight = qr_weight;
  let currentStartStep = start_step;
  let attempt = 0;
  let finalBuffer: Buffer | null = null;
  let isVerified = false;

  while (attempt <= max_retries && !isVerified) {
    console.log(
      `[HF-Gen] Attempt ${attempt + 1}: Weight=${currentQrWeight}, Start=${currentStartStep}`
    );

    // 2. Call Hugging Face Inference API (ControlNet)
    const response = await fetch(HF_API_URL, {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          negative_prompt,
          controlnet_conditioning_scale: currentQrWeight,
          control_guidance_start: currentStartStep,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
        image: qrBase64,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      // If service is loading, don't waste retries, just fail fast or wait
      if (response.status === 503)
        throw new Error('HF Model is currently loading');
      throw new Error(`HF API Error: ${response.status} - ${error}`);
    }

    const imageBlob = await response.blob();
    finalBuffer = Buffer.from(await imageBlob.arrayBuffer());

    // 3. Vision Check (Guardrail)
    const validation = await validateQRScannability(finalBuffer);
    if (validation.isScannable) {
      isVerified = true;
      console.log(`[HF-Gen] Validation Passed on attempt ${attempt + 1}`);
    } else {
      console.warn(
        `[HF-Gen] Scannability Check Failed. Adjusting parameters...`
      );
      // Heuristic adjustment: more weight to the QR, start sooner
      currentQrWeight += 0.25;
      currentStartStep = Math.max(0, currentStartStep - 0.1);
      attempt++;
    }
  }

  if (!finalBuffer) throw new Error('Failed to generate image buffer');

  // 4. Upload to Supabase Storage (Permanent Hosting)
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
