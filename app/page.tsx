import { HeroSection } from "./components/landing/HeroSection";
import { FeatureGrid } from "./components/landing/FeatureGrid";
import { PricingSection } from "./components/landing/PricingSection";
import { FooterSection } from "./components/landing/FooterSection";

export default function Page() {
  return (
    <main className="min-h-screen bg-black text-white">
      <HeroSection />
      <FeatureGrid />
      <PricingSection />
      <FooterSection />
    </main>
  );
}
