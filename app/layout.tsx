import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AuthiChain - AI-Powered Product Verification",
  description: "Multi-tenant blockchain authentication platform with AI-powered verification, NFT certificates, QR-based supply chain tracking, and autonomous revenue pipelines.",
  keywords: "authentication, product verification, blockchain, NFT, QR codes, supply chain",
  authors: [{ name: "AuthiChain" }],
  openGraph: {
    title: "AuthiChain - Product Authentication Platform",
    description: "AI-powered product verification on the blockchain.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
