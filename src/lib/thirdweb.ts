import { createThirdwebClient } from 'thirdweb';
import { baseSepolia, base } from 'thirdweb/chains';

// Fall back to a placeholder during SSR/build when the env var is not set.
// The real clientId must be provided at runtime via NEXT_PUBLIC_THIRDWEB_CLIENT_ID.
export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || 'not-configured',
});

// Active chain — override with NEXT_PUBLIC_THIRDWEB_CHAIN=base for production
const chainName = process.env.NEXT_PUBLIC_THIRDWEB_CHAIN ?? 'base-sepolia';
export const activeChain = chainName === 'base' ? base : baseSepolia;
