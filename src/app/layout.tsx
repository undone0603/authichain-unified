import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AuthiChain',
  description: 'AI-powered product authentication on the blockchain',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
