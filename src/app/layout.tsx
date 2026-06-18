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
  },
  twitter: {
    card: "summary_large_image",
    site: "@qronspace",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
