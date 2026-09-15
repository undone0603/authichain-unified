import jsQR from 'jsqr';

/**
 * VISION GUARDRAIL
 * Automatically verifies if a generated "Living QR" is actually scannable.
 */

export interface ValidationResult {
  isScannable: boolean;
  content?: string;
  error?: string;
}

/**
 * Attempts to decode a QR code from an image buffer.
 *
 * @param buffer The image buffer (PNG/JPG)
 * @returns Validation result with scannability status
 */
export async function validateQRScannability(buffer: Buffer): Promise<ValidationResult> {
  try {
    // Jimp v1 exposes the image class as a named export. Keep the import
    // dynamic so this guardrail remains compatible with Next.js/Turbopack.
    const { Jimp } = await import('jimp');

    if (!Jimp || typeof Jimp.read !== 'function') {
      throw new Error('Jimp failed to load properly');
    }

    const image = await Jimp.read(buffer);
    const { data, width, height } = image.bitmap;

    const code = jsQR(new Uint8ClampedArray(data), width, height);

    if (code) {
      console.log(`[Vision] Scan Successful: ${code.data.slice(0, 30)}...`);
      return {
        isScannable: true,
        content: code.data,
      };
    }

    console.warn('[Vision] Scan Failed: No QR code detected in image.');
    return {
      isScannable: false,
      error: 'UNSCANNABLE_IMAGE',
    };
  } catch (err: unknown) {
    console.error('[Vision] Internal processing error:', err);
    return {
      isScannable: false,
      error: err instanceof Error ? err.message : 'PROCESSING_ERROR',
    };
  }
}
