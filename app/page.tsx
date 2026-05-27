import { HeroSection } from "./components/landing/HeroSection";
import { FeatureGrid } from "./components/landing/FeatureGrid";
import { PricingSection } from "./components/landing/PricingSection";
import { FooterSection } from "./components/landing/FooterSection";
import { HeroStatsBar } from "./components/HeroStatsBar";
import { ScanDemo } from "./components/ScanDemoModal";
import { ConsensusRing } from "./components/ConsensusRing";
import { CertificatePreview } from "./components/CertificatePreview";
import { DppCountdown } from "./components/DppCountdown";
import { QronFlow } from "./components/QronFlow";
import { PricingCalculator } from "./components/PricingCalculator";
import { BrandMicrositeGenerator } from "./components/BrandMicrositeGenerator";

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* HERO */}
      <HeroSection />
      <HeroStatsBar />

      {/* TRUMARK */}
      <ScanDemo />

      {/* AI AUTOFLOW / 5-AGENT */}
      <ConsensusRing />

      {/* QR IDENTITY */}
      <CertificatePreview />

      {/* COMPLIANCE / EU DPP */}
      <DppCountdown />

      {/* FEATURE GRID */}
      <FeatureGrid />

      {/* $QRON TOKEN */}
      <QronFlow />

      {/* PRICING */}
      <PricingSection />
      <PricingCalculator />

      {/* FOOTER */}
      <FooterSection />
      <BrandMicrositeGenerator />
    </main>
  );
}
