import { ShieldCheck, ScanLine, Award, Boxes, Eye, Lock } from 'lucide-react';
import { BrandLanding } from './BrandLanding';

/**
 * AuthiChain (authichain.com) — the flagship B2B product-authentication brand
 * and the protocol's default. Renders the gold "Protocol" theme (no theme
 * class override; uses the :root tokens) with the AuthiChain teal accent.
 */
export function AuthichainHome() {
  return (
    <BrandLanding
      brandId="authichain"
      eyebrow="Enterprise Authentication"
      stats={[
        { value: 'Ed25519', label: 'Signed seals' },
        { value: 'Polygon', label: 'On-chain anchor' },
        { value: 'GPT-4', label: 'Vision analysis' },
        { value: '10', label: 'Industry verticals' },
      ]}
      features={[
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'Blockchain-Verified Seals',
          desc: 'Issue tamper-evident, cryptographically-signed seals for every product. Each scan proves authenticity against an immutable on-chain record.',
        },
        {
          icon: <ScanLine className="h-6 w-6" />,
          title: 'AI Image Authentication',
          desc: 'GPT-4 Vision inspects packaging, labels, and seals to flag counterfeits before they reach your customers — no special hardware required.',
        },
        {
          icon: <Award className="h-6 w-6" />,
          title: 'NFT Certificates',
          desc: 'Mint ERC-721 certificates of authenticity that travel with the product and transfer with ownership across its entire lifecycle.',
        },
        {
          icon: <Boxes className="h-6 w-6" />,
          title: 'Supply-Chain Provenance',
          desc: 'Track every hand-off from manufacture to shelf with QR-anchored events, giving buyers and regulators a verifiable chain of custody.',
        },
        {
          icon: <Eye className="h-6 w-6" />,
          title: 'Real-Time Verification',
          desc: 'Customers verify a product in one scan — instant authenticity, origin, and recall status from any phone camera.',
        },
        {
          icon: <Lock className="h-6 w-6" />,
          title: 'Enterprise Controls',
          desc: 'Role-based access, audit logging, and an immutable ledger of every action — built for compliance-grade supply chains.',
        },
      ]}
      closingLine="Protect Every Product. Verify Every Transaction."
    />
  );
}
