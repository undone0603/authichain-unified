import { ShieldCheck, Link2, Search, Download, Lock, Building2 } from 'lucide-react';
import { BrandLanding } from './BrandLanding';
import { GovchainSections } from './GovchainSections';

export function GovchainHome() {
  return (
    <BrandLanding
      brandId="govchain"
      themeClass="theme-patriotic"
      eyebrow="Public Sector Records"
      headline="A permanent record for public records."
      subhead="GovChain seals permits, filings, and official documents to a tamper-evident ledger — so agencies, auditors, and the public can confirm a record hasn't been altered."
      stats={[
        { value: '256-bit', label: 'SHA-3 Hash' },
        { value: 'Instant', label: 'Seal Time' },
        { value: 'SOC 2', label: 'Compliant' },
        { value: 'Open', label: 'Verification' },
      ]}
      features={[
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'Document Sealing',
          desc: 'Lock a filed document to an immutable fingerprint the moment it is finalized.',
        },
        {
          icon: <Link2 className="h-6 w-6" />,
          title: 'Chain of Custody',
          desc: 'Track every hand-off of a record between offices, with timestamps.',
        },
        {
          icon: <Search className="h-6 w-6" />,
          title: 'Public Verification Portal',
          desc: 'A simple lookup page for residents to confirm a record is authentic.',
        },
        {
          icon: <Download className="h-6 w-6" />,
          title: 'Audit Trail Export',
          desc: "Produce a full history of a record's seals and access for review.",
        },
        {
          icon: <Lock className="h-6 w-6" />,
          title: 'Role-Based Access',
          desc: 'Control which staff can upload, seal, or amend records by department.',
        },
        {
          icon: <Building2 className="h-6 w-6" />,
          title: 'Multi-Agency Support',
          desc: 'Separate, permissioned workspaces for each department or jurisdiction.',
        },
      ]}
      primaryCta={{ label: 'Request Access', href: '/contact' }}
      secondaryCta={{ label: 'See How Sealing Works', href: '#seal' }}
      closingLine="Bring tamper-evident recordkeeping to your agency."
    >
      <GovchainSections />
    </BrandLanding>
  );
}
