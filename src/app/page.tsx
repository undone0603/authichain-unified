import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BRANDS, resolveBrand, type BrandId } from '@shared/brands';
import { QronHome } from './_home/QronHome';
import { AuthichainHome } from './_home/AuthichainHome';
import { StrainchainHome } from './_home/StrainchainHome';
import { GovchainHome } from './_home/GovchainHome';

// The homepage renders a different brand experience per host (authichain.com,
// qron.space, strainchain.io, govchain.us), so it must read the request and
// cannot be statically prerendered.
export const dynamic = 'force-dynamic';

async function currentBrand(): Promise<BrandId> {
  const h = await headers();
  // Edge middleware (src/middleware.ts) resolves the brand from the Host header
  // and forwards it as x-brand; fall back to resolving the host directly.
  const fromHeader = h.get('x-brand');
  if (fromHeader && fromHeader in BRANDS) return fromHeader as BrandId;
  return resolveBrand(h.get('host'));
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = BRANDS[await currentBrand()];
  return {
    title: `${brand.displayName} | ${brand.tagline}`,
    description: brand.description,
  };
}

export default async function HomePage() {
  switch (await currentBrand()) {
    case 'authichain':
      return <AuthichainHome />;
    case 'strainchain':
      return <StrainchainHome />;
    case 'govchain':
      return <GovchainHome />;
    case 'qron':
    default:
      return <QronHome />;
  }
}
