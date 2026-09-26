import type { Metadata } from "next";
import { systemFont } from "@/lib/system-font";
import "./genetics.css";

const fraunces = systemFont({ variable: "--font-fraunces" });
const publicSans = systemFont({ variable: "--font-public-sans" });
const plexMono = systemFont({ variable: "--font-plex-mono" });

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
