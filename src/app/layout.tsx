import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/components/TRPCProvider";

// Resolve metadataBase defensively. NEXT_PUBLIC_APP_URL can be misconfigured in
// the deploy env (e.g. set to the literal string '""', or a bare host with no
// protocol). A truthy-but-invalid value slips past `|| fallback` and makes
// `new URL()` throw ERR_INVALID_URL at build time — which fails `next build`
// while collecting page data for every route. Strip quotes/whitespace, add a
// protocol if missing, and fall back to a known-good URL on any failure.
function resolveMetadataBase(): URL {
  const fallback = "https://qron.space";
  let raw = (process.env.NEXT_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (raw && !/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw || fallback);
  } catch {
    return new URL(fallback);
  }
}

export const metadata: Metadata = {
  title: {
    default: "QRON — AI-Powered Authenticated QR Art",
    template: "%s | QRON",
  },
  description:
    "Create cryptographically verified, Ed25519-signed QR art with the AuthiChain Protocol. Blockchain-anchored, publicly verifiable, ~100% scan rate.",
  metadataBase: resolveMetadataBase(),
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
