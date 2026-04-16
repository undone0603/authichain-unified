import { BRANDS } from "@shared/brands";
import { Leaf, Package, FileCheck2, Boxes, Truck, Gem } from "lucide-react";
import { BrandLanding } from "./BrandLanding";

const features = [
  { icon: FileCheck2, title: "Seed-to-Sale Compliance",   desc: "METRC and BioTrack integration for cultivators, processors, and dispensaries. Every gram hashed on-chain." },
  { icon: Leaf,       title: "Strain NFTs",               desc: "ERC-721 strain identities with THC/CBD basis points, terpene profile, and lab-cert hash. Own the genetics, not just the jar." },
  { icon: Package,    title: "Bagiez Package Art",        desc: "Vintage packaging art NFTs with territory licensing — 70% artist / 20% platform / 10% community treasury on primary sale." },
  { icon: Truck,      title: "Dispensary SaaS",           desc: "POS-grade inventory, lab-result QR codes at every SKU, and tamper-evident chain-of-custody for buyers." },
  { icon: Gem,        title: "Royalties That Route",      desc: "Secondary-sale royalties split automatically between artist, platform, and community treasury via Solidity splitter." },
  { icon: Boxes,      title: "$29 / $99 / $299 Tiers",    desc: "Starter for single-license cultivators, Professional for processors, Enterprise for multi-state operators." },
];

export default function StrainChainHome() {
  return <BrandLanding brand={BRANDS.strainchain} Logo={Leaf} features={features} />;
}
