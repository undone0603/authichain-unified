'use client';

import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const ThirdwebProvider = dynamic(
  () => import('thirdweb/react').then(m => ({ default: m.ThirdwebProvider })),
  { ssr: false }
);

export function ThirdwebClientProvider({ children }: { children: ReactNode }) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>;
}
