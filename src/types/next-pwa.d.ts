declare module 'next-pwa' {
  import { NextConfig } from 'next';
  function withPWA(config: unknown): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}

declare module 'jsqr' {
  interface QRCode {
    binaryData: number[];
    data: string;
    chunks: unknown[];
    version: number;
    location: {
      topRightCorner: { x: number; y: number };
      topLeftCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
    };
  }
  function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: string }): QRCode | null;
  export default jsQR;
}

declare module 'jimp' {
  interface JimpImage {
    bitmap: { data: Buffer; width: number; height: number };
    resize(w: number, h: number): this;
    greyscale(): this;
  }
  interface JimpConstructor {
    read(buffer: Buffer): Promise<JimpImage>;
    MIME_PNG: string;
    MIME_JPEG: string;
  }
  const Jimp: JimpConstructor;
  export default Jimp;
  export { Jimp };
  export function read(buffer: Buffer): Promise<JimpImage>;
}
