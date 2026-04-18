import { BRANDS } from "@shared/brands";
import { QrCode, Sparkles, Layers, Share2, Palette, Zap } from "lucide-react";
import { BrandLanding } from "./BrandLanding";

const features = [
  { icon: Palette,  title: "11 Art Styles",        desc: "Cosmic nebula, cyberpunk, watercolor, holographic mosaic, teal pulse, medieval fantasy, anime, architectural, echo/video/phantom QR." },
  { icon: Sparkles, title: "Illusion Diffusion",   desc: "fal.ai pipeline at $0.006 per render. Custom LoRA trigger word `qronart` keeps the style coherent across every generation." },
  { icon: QrCode,   title: "Still Scannable",      desc: "`controlnet_conditioning_scale: 1.0–1.5` guarantees a phone reads your art as a working QR code every time." },
  { icon: Zap,      title: "Scan-to-Earn $QRON",   desc: "+50 XP first scan, +10 per verify, +100 counterfeit report. Stake 1K QRON for a 2% subscription discount." },
  { icon: Layers,   title: "Free / Pro / Business", desc: "5 free/day, Pro at $29/mo, Business at $99/mo. PLG motion, no sales call needed." },
  { icon: Share2,   title: "Share Everywhere",     desc: "Every QR lives at a shareable URL with analytics, so your art doubles as a marketing surface." },
];

export default function QronHome() {
  return <BrandLanding brand={BRANDS.qron} Logo={QrCode} features={features} />;
}
