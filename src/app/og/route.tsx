import { ImageResponse } from 'next/og';
import { BRANDS, resolveBrand, type BrandId } from '@shared/brands';

// Dynamic Open Graph image generator. Usage:
//   /og?title=AuthiChain%20vs%20Scantrust&brand=authichain
// Returns a 1200x630 branded card. Runs on the edge for fast, cached delivery.
export const runtime = 'edge';

const BRAND_HEX: Record<BrandId, string> = {
  authichain: '#00FFD1',
  qron: '#F59E0B',
  strainchain: '#22C55E',
  govchain: '#3B82F6',
};

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'AuthiChain Protocol').slice(0, 120);
  const brandParam = searchParams.get('brand');
  const brandId: BrandId =
    brandParam && brandParam in BRANDS
      ? (brandParam as BrandId)
      : resolveBrand(brandParam);
  const brand = BRANDS[brandId];
  const accent = BRAND_HEX[brandId];

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000000',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '320px',
            background: `radial-gradient(ellipse 60% 100% at 20% 0%, ${accent}33 0%, transparent 70%)`,
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: accent,
              display: 'flex',
            }}
          />
          <div
            style={{
              color: '#ffffff',
              fontSize: '30px',
              fontWeight: 800,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            {brand.displayName}
          </div>
        </div>

        <div
          style={{
            color: '#ffffff',
            fontSize: title.length > 48 ? '68px' : '84px',
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            display: 'flex',
            maxWidth: '1000px',
          }}
        >
          {title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '6px',
              borderRadius: '3px',
              background: accent,
              display: 'flex',
            }}
          />
          <div
            style={{
              color: '#a1a1aa',
              fontSize: '26px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              display: 'flex',
            }}
          >
            {brand.domain}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
