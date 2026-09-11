import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "../genetics/genetics.css";

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

/**
 * Unit passports share the genetics stylesheet on purpose: a verification
 * surface earns trust by being recognisable, so a unit seal and a cultivar
 * dossier read as the same document family (decision D5).
 */
export default function PassportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}
