'use server'

// Generation runs through the qron-image-gen worker (Cloudflare Workers AI);
// the previous HuggingFace hf-inference path no longer hosts the models.
const QRON_WORKER_URL =
  process.env.QRON_WORKER_URL || 'https://qron-image-gen.undone-k.workers.dev';

export async function generateAutomotiveQRON(vendorName: string, destinationUrl: string) {
  console.log(`🎨 Initiating QRON Generation for: ${vendorName}`);

  try {
    // Prompt engineered specifically for the "Donald's Dust-Off" aesthetic
    const prompt = `A highly defined, scannable QR code embedded in brushed aluminum and polished chrome, sitting on a vintage leather workbench, classic automotive restoration aesthetic, industrial lighting, photorealistic, 8k resolution.`;

    const res = await fetch(`${QRON_WORKER_URL}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: destinationUrl, prompt, style: 'raw' }),
      signal: AbortSignal.timeout(75_000),
    });

    if (!res.ok) {
      throw new Error(`Worker returned ${res.status}`);
    }

    const data = (await res.json()) as { downloadUrl?: string };
    if (!data.downloadUrl) {
      throw new Error('Worker response missing downloadUrl');
    }

    return {
      success: true,
      vendor: vendorName,
      imageUrl: data.downloadUrl
    };

  } catch (error) {
    console.error("QRON generation error:", error);
    return { success: false, error: 'Failed to generate QRON artifact.' };
  }
}
