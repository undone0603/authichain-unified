import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AuthiChain",
  description: "The Truth Layer for the Global Economy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
