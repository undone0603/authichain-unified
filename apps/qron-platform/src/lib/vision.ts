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
    // Dynamic import for jimp to handle ESM issues in Next.js/Turbopack
    const JimpModule = await import('jimp') as unknown as {
      default?: {
        read(buffer: Buffer): Promise<{
          bitmap: { data: Buffer; width: number; height: number };
        }>;
      };
      read?: (buffer: Buffer) => Promise<{
        bitmap: { data: Buffer; width: number; height: number };
      }>;
    };
    
    const jimp = JimpModule.default || (JimpModule as NonNullable<typeof JimpModule.default>);
    
    if (!jimp || typeof jimp.read !== 'function') {
      throw new Error('Jimp failed to load properly');
    }

    const image = await jimp.read(buffer);
    const { data, width, height } = image.bitmap;

    const code = jsQR(new Uint8ClampedArray(data), width, height);

    if (code) {
      console.log(`[Vision] Scan Successful: ${code.data.slice(0, 30)}...`);
      return {
        isScannable: true,
        content: code.data
      };
    }

    console.warn('[Vision] Scan Failed: No QR code detected in image.');
    return {
      isScannable: false,
      error: 'UNSCANNABLE_IMAGE'
    };

  } catch (err: unknown) {
    console.error('[Vision] Internal processing error:', err);
    return {
      isScannable: false,
      error: err instanceof Error ? err.message : 'PROCESSING_ERROR'
    };
  }
}
