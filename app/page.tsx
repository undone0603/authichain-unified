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
    <main>
      <section>
        <h1>VERIFY EVERYTHING.</h1>
        <HeroStatsBar />
      </section>

      <section id="trumark">
        <ScanDemo />
      </section>

      <section id="autoflow">
        <ConsensusRing />
      </section>

      <section id="qr-identity">
        <CertificatePreview />
      </section>

      <section id="compliance">
        <DppCountdown />
      </section>

      <section id="qron">
        <QronFlow />
      </section>

      <section id="pricing">
        <PricingCalculator />
      </section>

      <footer>
        <BrandMicrositeGenerator />
      </footer>
    </main>
  );
}
