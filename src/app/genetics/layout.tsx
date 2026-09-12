import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./genetics.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Not indexed. D2 in docs/strategy/strainchain-genetics-passport.md: the dossier
// is the breeder's defensive record, not our catalogue. A cultivar dossier names
// a real farm and publishes its chemistry, its lineage, and — via D8 — where that
// lineage is only claimed rather than confirmed. Letting search engines carry that
// before the breeder has agreed to publication is the Phylos failure the whole
// strategy is written against: the aggregator turning a breeder's life's work into
// its own shop window.
//
// Flip to index:true per farm, only once that farm has agreed in writing to its
// dossier being public. Not a blanket setting to revisit casually.
export const metadata: Metadata = {
  title: { default: "Genetics passport", template: "%s · StrainChain" },
  robots: { index: false, follow: false },
};

export default function GeneticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`dossier ${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}
