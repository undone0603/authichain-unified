import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/components/TRPCProvider";

export const metadata: Metadata = {
  title: {
    default: "QRON — AI-Powered Authenticated QR Art",
    template: "%s | QRON",
  },
  description:
    "Create cryptographically verified, Ed25519-signed QR art with the AuthiChain Protocol. Blockchain-anchored, publicly verifiable, ~100% scan rate.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://qron.space"
  ),
  openGraph: {
    siteName: "QRON",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/media/samples/03_flux_authichain.png",
        width: 1200,
        height: 630,
        alt: "QRON — AI-Powered QR Art by AuthiChain Protocol",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@qronspace",
    images: ["/media/samples/03_flux_authichain.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: [
    "QR code generator",
    "AI QR art",
    "authenticated QR codes",
    "blockchain verification",
    "AuthiChain",
    "Ed25519",
    "digital credentials",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "QRON",
              applicationCategory: "DesignApplication",
              operatingSystem: "Web",
              description:
                "AI-powered QR code art generator with Ed25519 cryptographic signing and blockchain verification via the AuthiChain Protocol.",
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "USD",
                lowPrice: "0",
                highPrice: "49",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                reviewCount: "47",
              },
              creator: {
                "@type": "Organization",
                name: "AuthiChain",
                url: "https://authichain.com",
              },
            }),
          }}
        />
      </head>
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
