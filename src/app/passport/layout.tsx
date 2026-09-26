import { systemFont } from "@/lib/system-font";
import "../genetics/genetics.css";

const fraunces = systemFont({ variable: "--font-fraunces" });
const publicSans = systemFont({ variable: "--font-public-sans" });
const plexMono = systemFont({ variable: "--font-plex-mono" });

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
