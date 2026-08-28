// @ts-nocheck
// This is a self-contained demo/prototype UI (sample DPP data, a simulated
// agent orchestration log) ported in as-is; untyped props throughout are
// intentional rather than an oversight.
'use client';

import React, { useState, useMemo } from 'react';

const Icons = {
  ShieldCheck: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  Cpu: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5M4.5 15.75H3m18 0h-1.5M8.25 21v-1.5m7.5 1.5v-1.5M12 3v1.5m0 16.5v-1.5m3.75-18v1.5M12 8.25h-1.5m1.5 0h1.5m-1.5 0v1.5m0-1.5V6.75m1.5 5.25h1.5m-1.5 0h-1.5m1.5 0v1.5m0-1.5v-1.5m-5.25 3h1.5m-1.5 0h-1.5m1.5 0v1.5m0-1.5v-1.5m3 3h1.5m-1.5 0h-1.5m1.5 0v1.5m0-1.5v-1.5M6 6h12v12H6V6z" />
    </svg>
  ),
  Database: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  QrCode: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM6.75 6.75h.008v.008H6.75V6.75zM6.75 16.5h.008v.008H6.75V16.5zM16.5 6.75h.008v.008H16.5V6.75zM13.5 13.5h2.25v2.25H13.5V13.5zM13.5 18h2.25v2.25H13.5V18zM18 13.5h2.25v2.25H18V13.5zM18 18h2.25v2.25H18V18zM15.75 15.75h2.25v2.25h-2.25v-2.25z" />
    </svg>
  ),
  Leaf: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21V10.5m0 0L7.5 6m4.5 4.5l4.5-4.5M3.284 14.253a9 9 0 010-4.506M20.716 14.253a9 9 0 000-4.506M3.284 9.747A9 9 0 0112 3c4.148 0 7.643 2.8 8.716 6.747" />
    </svg>
  ),
  Layers: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l10.5 5.25L21.75 12l-4.179-2.25M6.429 9.75L12 12.75l5.571-3M6.429 9.75L12 6.75l5.571 3M12 3L2.25 8.25l9.75 5.25 9.75-5.25L12 3zM2.25 15.75l10.5 5.25 10.5-5.25" />
    </svg>
  ),
  RefreshCw: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  CheckCircle2: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  AlertTriangle: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  FileText: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  Globe: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21V10.5m0 0L7.5 6m4.5 4.5l4.5-4.5M3.284 14.253a9 9 0 010-4.506M20.716 14.253a9 9 0 000-4.506M3.284 9.747A9 9 0 0112 3c4.148 0 7.643 2.8 8.716 6.747" />
    </svg>
  ),
  Truck: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.75 18.75a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 4.5h10.5a1.125 1.125 0 011.125 1.125v10.125H2.25V4.5zM13.875 10.5h3.836a1.125 1.125 0 01.928.487l2.25 3.375a1.125 1.125 0 01.161.588v3.3a1.125 1.125 0 01-1.125 1.125h-1.5M13.875 10.5V18.75" />
    </svg>
  ),
  Factory: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M3.75 3h16.5M3.75 21V3m16.5 18V3M7.5 21v-4.5a1.5 1.5 0 011.5-1.5h6a1.5 1.5 0 011.5 1.5V21" />
    </svg>
  ),
  Recycle: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  ArrowRight: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  ),
  Search: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  ExternalLink: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  ),
  Zap: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  ChevronRight: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  Copy: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  ),
  Play: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  ),
  Plus: (props) => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
};

const INITIAL_PRODUCTS = [
  {
    id: "prod_dpp_001",
    qron_id: "QRON-8849-DPP-ECO",
    name: "EcoTech UltraBook 15 Pro",
    sku: "ET-UB15-2026",
    category: "Consumer Electronics",
    brand: "EcoTech Corp",
    dpp_status: "DPP_COMPLIANT",
    created_at: "2026-08-15T10:30:00Z",
    updated_at: "2026-08-20T14:12:00Z",
    metadata: {
      dpp_version: "2.1-EU-ESPR",
      regulatory_standard: "EU ESPR 2024/1781 & Battery Reg 2023/1542",
      dpp_compliance_status: "VERIFIED",
      compliance_agent_id: "agent_compliance_v4",
      builder_agent_id: "agent_builder_v2",
      verification_hash: "0x8f9c12e73a4b91d2e85040f1a942bc3d71e16f94",
      
      // Sustainability & Lifecycle Metrics
      sustainability: {
        carbon_footprint_kg_co2e: 142.5,
        recycled_content_percent: 78.4,
        repairability_index: 8.9,
        circularity_score: 92,
        water_footprint_liters: 1250,
        expected_lifespan_years: 7,
        energy_efficiency_class: "A+++"
      },

      // Material Composition Breakdown
      materials: [
        { name: "Recycled Aluminum (Chassis)", percentage: 65, recycled: true, hazardous: false },
        { name: "Post-Consumer PCR Plastic", percentage: 18, recycled: true, hazardous: false },
        { name: "Lithium Nickel Cobalt Manganese Battery", percentage: 12, recycled: false, hazardous: true },
        { name: "Glass & Rare Earth Elements", percentage: 5, recycled: false, hazardous: false }
      ],

      // Hazardous Substances & Environmental Safety
      hazardous_substances: {
        reach_svhc_status: "PASSED_NONE_EXCEEDED",
        rohs_compliant: true,
        pfas_free: true,
        heavy_metals_ppm: { lead: 0, cadmium: 0, mercury: 0 }
      },

      // Supply Chain & Provenance (Chain of Custody)
      supply_chain: [
        { stage: "Raw Material Extraction", location: "Atacama & Nordics", certified_by: "SGS EcoCert", timestamp: "2026-01-10" },
        { stage: "Cell & Component Smelting", location: "Stuttgart, Germany", certified_by: "TÜV Rheinland", timestamp: "2026-03-04" },
        { stage: "Final Clean Energy Assembly", location: "Eindhoven, Netherlands", certified_by: "ISO 14001 Hub", timestamp: "2026-05-18" },
        { stage: "EU Distribution Center", location: "Antwerp Logistics Port", certified_by: "Authichain Node", timestamp: "2026-07-02" }
      ],

      // Circular Economy & End of Life (EOL)
      end_of_life: {
        takeback_program_active: true,
        disassembly_guide_url: "https://authichain.org/dpp/guides/ET-UB15-disassembly.pdf",
        recycling_centers: ["Berlin E-Waste Hub", "Lyon Circular Depot", "Oslo Metals Recycler"]
      }
    }
  },
  {
    id: "prod_dpp_002",
    qron_id: "QRON-3102-BAT-EU",
    name: "VoltCell Heavy EV Battery Module 80kWh",
    sku: "VC-EV80-2026",
    category: "Industrial Energy & Batteries",
    brand: "VoltCell Systems",
    dpp_status: "DPP_COMPLIANT",
    created_at: "2026-08-01T08:15:00Z",
    updated_at: "2026-08-11T11:00:00Z",
    metadata: {
      dpp_version: "2.1-EU-ESPR",
      regulatory_standard: "EU Battery Passport Regulation 2023/1542",
      dpp_compliance_status: "VERIFIED",
      compliance_agent_id: "agent_compliance_v4",
      builder_agent_id: "agent_builder_v2",
      verification_hash: "0x3e7102f91a5c68d402128e028f89bc992a014911",

      sustainability: {
        carbon_footprint_kg_co2e: 840.0,
        recycled_content_percent: 42.0,
        repairability_index: 9.4,
        circularity_score: 88,
        water_footprint_liters: 4500,
        expected_lifespan_years: 12,
        energy_efficiency_class: "A+"
      },

      materials: [
        { name: "Synthetic Graphite Anode", percentage: 30, recycled: true, hazardous: false },
        { name: "NMC 811 Cathode Powder", percentage: 35, recycled: true, hazardous: true },
        { name: "Solid-state Electrolyte", percentage: 15, recycled: false, hazardous: true },
        { name: "Structural Aluminum Casing", percentage: 20, recycled: true, hazardous: false }
      ],

      hazardous_substances: {
        reach_svhc_status: "DECLARED_WITHIN_LIMITS",
        rohs_compliant: true,
        pfas_free: true,
        heavy_metals_ppm: { lead: 12, cadmium: 0, mercury: 0 }
      },

      supply_chain: [
        { stage: "Lithium & Cobalt Origin", location: "Kwinana, Australia", certified_by: "IRMA Standard", timestamp: "2026-02-01" },
        { stage: "Cathode Active Production", location: "Katowice, Poland", certified_by: "DNV GL", timestamp: "2026-04-12" },
        { stage: "Battery GigaFactory Assembly", location: "Skellefteå, Sweden", certified_by: "Nordic Green Cert", timestamp: "2026-06-20" }
      ],

      end_of_life: {
        takeback_program_active: true,
        disassembly_guide_url: "https://authichain.org/dpp/guides/VC-EV80-battery-recycling.pdf",
        recycling_centers: ["Nordic Battery Recycling", "French Cobalt Reclamation"]
      }
    }
  },
  {
    id: "prod_dpp_003",
    qron_id: "QRON-9912-TEX-CIRC",
    name: "Circular Bio-Wool Alpine Parka",
    sku: "BW-AP-2026",
    category: "Apparel & Textiles",
    brand: "Valais Apparel",
    dpp_status: "DPP_COMPLIANT",
    created_at: "2026-08-22T16:00:00Z",
    updated_at: "2026-08-25T09:40:00Z",
    metadata: {
      dpp_version: "2.1-EU-ESPR",
      regulatory_standard: "EU EcoDesign for Sustainable Products (ESPR)",
      dpp_compliance_status: "VERIFIED",
      compliance_agent_id: "agent_compliance_v4",
      builder_agent_id: "agent_builder_v2",
      verification_hash: "0x12a0482b9911ef032d8471012c8e31a89f92023e",

      sustainability: {
        carbon_footprint_kg_co2e: 18.2,
        recycled_content_percent: 91.0,
        repairability_index: 9.8,
        circularity_score: 96,
        water_footprint_liters: 320,
        expected_lifespan_years: 10,
        energy_efficiency_class: "N/A"
      },

      materials: [
        { name: "Organic Regenerative Merino Wool", percentage: 70, recycled: false, hazardous: false },
        { name: "Recycled Ocean Nylon Trim", percentage: 25, recycled: true, hazardous: false },
        { name: "Biodegradable Plant Zippers", percentage: 5, recycled: true, hazardous: false }
      ],

      hazardous_substances: {
        reach_svhc_status: "PASSED_ZERO_TOXIC",
        rohs_compliant: true,
        pfas_free: true,
        heavy_metals_ppm: { lead: 0, cadmium: 0, mercury: 0 }
      },

      supply_chain: [
        { stage: "Regenerative Farm Wool Shearing", location: "Valais, Switzerland", certified_by: "GOTS Certified", timestamp: "2026-03-01" },
        { stage: "Zero-Chemical Weaving Mill", location: "Biella, Italy", certified_by: "OEKO-TEX 100", timestamp: "2026-04-18" },
        { stage: "Garment Tailoring", location: "Porto, Portugal", certified_by: "Fair Wear Foundation", timestamp: "2026-06-05" }
      ],

      end_of_life: {
        takeback_program_active: true,
        disassembly_guide_url: "https://authichain.org/dpp/guides/BW-AP-textile-return.pdf",
        recycling_centers: ["EcoTextile Loop Europe"]
      }
    }
  }
];

export default function AuthichainDPPApp() {
  const [activeTab, setActiveTab] = useState('viewer'); // 'viewer' | 'orchestrator' | 'schema' | 'inventory'
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [selectedQronId, setSelectedQronId] = useState('QRON-8849-DPP-ECO');
  const [searchInput, setSearchInput] = useState('');
  const [copiedText, setCopiedText] = useState('');

  // Selected product object
  const currentProduct = useMemo(() => {
    return products.find(p => p.qron_id.toUpperCase() === selectedQronId.toUpperCase()) || products[0];
  }, [products, selectedQronId]);

  // Handle QRON lookup
  const handleQronSearch = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const found = products.find(p => p.qron_id.toLowerCase().includes(searchInput.toLowerCase().trim()));
    if (found) {
      setSelectedQronId(found.qron_id);
    } else {
      setSelectedQronId(searchInput.trim());
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      {}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand & Repo Identifier */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <Icons.ShieldCheck className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Authichain Unified
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
                  v2.4 DPP Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Orchestration & EU DPP Compliance Portal
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'viewer'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icons.QrCode className="w-4 h-4" />
              <span>DPP Public Viewer</span>
            </button>

            <button
              onClick={() => setActiveTab('orchestrator')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'orchestrator'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icons.Cpu className="w-4 h-4" />
              <span>Agent Orchestration</span>
            </button>

            <button
              onClick={() => setActiveTab('schema')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'schema'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icons.Database className="w-4 h-4" />
              <span>Supabase & Schema</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icons.Layers className="w-4 h-4" />
              <span>Asset Inventory</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body View Switching */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {activeTab === 'viewer' && (
          <DPPClientViewer 
            currentProduct={currentProduct}
            products={products}
            setSelectedQronId={setSelectedQronId}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            handleQronSearch={handleQronSearch}
            copyToClipboard={copyToClipboard}
            copiedText={copiedText}
          />
        )}

        {activeTab === 'orchestrator' && (
          <AgentOrchestrationStudio 
            products={products}
            setProducts={setProducts}
            setSelectedQronId={(id) => {
              setSelectedQronId(id);
              setActiveTab('viewer');
            }}
          />
        )}

        {activeTab === 'schema' && (
          <SupabaseSchemaViewer copyToClipboard={copyToClipboard} copiedText={copiedText} />
        )}

        {activeTab === 'inventory' && (
          <AssetInventoryTable 
            products={products}
            onSelectProduct={(id) => {
              setSelectedQronId(id);
              setActiveTab('viewer');
            }}
          />
        )}
      </main>
    </div>
  );
}

function DPPClientViewer({ currentProduct, products, setSelectedQronId, searchInput, setSearchInput, handleQronSearch, copyToClipboard, copiedText }) {
  const [activeDppTab, setActiveDppTab] = useState('overview'); // 'overview' | 'sustainability' | 'materials' | 'provenance' | 'compliance'

  const m = currentProduct?.metadata || {};
  const s = m.sustainability || {};

  return (
    <div className="space-y-6">
      {}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Icons.QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Scan or Lookup Digital Product Passport (DPP)</h2>
              <p className="text-xs text-slate-400">Enter a <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 font-mono">qron_id</code> to resolve real-time product compliance metadata</p>
            </div>
          </div>

          <form onSubmit={handleQronSearch} className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Icons.Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. QRON-8849-DPP-ECO"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-emerald-400 transition-colors"
            >
              Resolve Passport
            </button>
          </form>
        </div>

        {/* Quick Sample Selector */}
        <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Quick Samples:</span>
          {products.map(p => (
            <button
              key={p.qron_id}
              onClick={() => setSelectedQronId(p.qron_id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                currentProduct?.qron_id === p.qron_id
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              {p.qron_id} ({p.brand})
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 lg:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                <Icons.CheckCircle2 className="w-3.5 h-3.5" />
                {m.dpp_compliance_status || "VERIFIED"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {m.regulatory_standard || "EU ESPR Standard"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-teal-300 border border-teal-500/20">
                {m.dpp_version || "DPP v2.1"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-100 tracking-tight">
              {currentProduct.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <p><span className="text-slate-500">Brand:</span> <span className="font-medium text-slate-200">{currentProduct.brand}</span></p>
              <p><span className="text-slate-500">SKU:</span> <code className="font-mono text-slate-300">{currentProduct.sku}</code></p>
              <p><span className="text-slate-500">Category:</span> <span className="text-slate-300">{currentProduct.category}</span></p>
              <p className="flex items-center gap-1">
                <span className="text-slate-500">QRON Token ID:</span> 
                <code className="text-emerald-400 font-mono font-semibold">{currentProduct.qron_id}</code>
                <button 
                  onClick={() => copyToClipboard(currentProduct.qron_id, 'qron')} 
                  className="text-slate-500 hover:text-emerald-400 transition-colors ml-1"
                  title="Copy QRON ID"
                >
                  <Icons.Copy className="w-3.5 h-3.5" />
                </button>
                {copiedText === 'qron' && <span className="text-[10px] text-emerald-400 font-mono">Copied!</span>}
              </p>
            </div>
          </div>

          {/* Cryptographic Proof Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1 text-slate-300 font-medium">
                <Icons.ShieldCheck className="w-4 h-4 text-emerald-400" />
                Blockchain Proof Anchoring
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                On-Chain
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 break-all bg-slate-900 p-2 rounded-lg border border-slate-800/80">
              {m.verification_hash || "0x8f9c12e73a4b91d2e85040f1a942bc3d71e16f94"}
            </p>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Agent Verified:</span>
              <span className="text-slate-200 font-mono text-[10px]">{m.compliance_agent_id || "agent_compliance_v4"}</span>
            </div>
          </div>
        </div>

        {}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Carbon Footprint</span>
              <Icons.Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-black text-slate-100">{s.carbon_footprint_kg_co2e ?? 'N/A'}</span>
              <span className="text-xs text-slate-400">kg CO₂e</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Lifecycle Scope 1-3 ISO 14067</p>
          </div>

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Recycled Material</span>
              <Icons.Recycle className="w-4 h-4 text-teal-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-black text-emerald-400">{s.recycled_content_percent ?? 'N/A'}%</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Post-consumer & pre-consumer</p>
          </div>

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Repairability Index</span>
              <Icons.Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-black text-amber-400">{s.repairability_index ?? 'N/A'}</span>
              <span className="text-xs text-slate-400">/ 10</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Modular design rating</p>
          </div>

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Circularity Score</span>
              <Icons.RefreshCw className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1">
              <span className="text-2xl font-black text-cyan-400">{s.circularity_score ?? 'N/A'}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Take-back & recycling path</p>
          </div>
        </div>
      </div>

      {}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveDppTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeDppTab === 'overview'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          General & Metadata Overview
        </button>
        <button
          onClick={() => setActiveDppTab('materials')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeDppTab === 'materials'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Material Composition ({m.materials?.length || 0})
        </button>
        <button
          onClick={() => setActiveDppTab('provenance')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeDppTab === 'provenance'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Supply Chain Provenance ({m.supply_chain?.length || 0})
        </button>
        <button
          onClick={() => setActiveDppTab('compliance')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeDppTab === 'compliance'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Safety & Disassembly Guidelines
        </button>
      </div>

      {}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeDppTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icons.FileText className="w-4 h-4 text-emerald-400" />
                Regulatory Identity Attributes
              </h3>
              <dl className="divide-y divide-slate-800 text-xs">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">EU ESPR Directive Status</dt>
                  <dd className="text-emerald-400 font-semibold">Compliant</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Regulatory Framework</dt>
                  <dd className="text-slate-200">{m.regulatory_standard}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Energy Efficiency Class</dt>
                  <dd className="text-slate-200 font-semibold">{s.energy_efficiency_class}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Expected Lifespan</dt>
                  <dd className="text-slate-200">{s.expected_lifespan_years} Years guaranteed</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Water Footprint Impact</dt>
                  <dd className="text-slate-200">{s.water_footprint_liters} Liters</dd>
                </div>
              </dl>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icons.Cpu className="w-4 h-4 text-teal-400" />
                Authichain Agent Registration Metadata
              </h3>
              <dl className="divide-y divide-slate-800 text-xs">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Compliance Agent</dt>
                  <dd className="font-mono text-slate-300">{m.compliance_agent_id}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Builder Agent</dt>
                  <dd className="font-mono text-slate-300">{m.builder_agent_id}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Registered In DB</dt>
                  <dd className="text-slate-300 font-mono">{currentProduct.created_at}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">Last Passport Audit</dt>
                  <dd className="text-slate-300 font-mono">{currentProduct.updated_at}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Material Composition Tab */}
        {activeDppTab === 'materials' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icons.Layers className="w-4 h-4 text-emerald-400" />
                Material Composition & Recycled Fraction
              </h3>
              <p className="text-xs text-slate-400 mt-1">Full breakdown of input substances required for mandatory circular economy declarations.</p>
            </div>

            <div className="space-y-4">
              {m.materials?.map((mat, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{mat.name}</span>
                    <span className="font-mono text-emerald-400 font-bold">{mat.percentage}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      style={{ width: `${mat.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    <span className={mat.recycled ? "text-emerald-400 font-medium" : "text-slate-500"}>
                      {mat.recycled ? "✓ Recycled Source" : "• Virgin Origin"}
                    </span>
                    <span className={mat.hazardous ? "text-amber-400 font-medium" : "text-slate-500"}>
                      {mat.hazardous ? "⚠ Controlled Substance" : "✓ Non-hazardous"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provenance Tab */}
        {activeDppTab === 'provenance' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icons.Truck className="w-4 h-4 text-emerald-400" />
                Audited Supply Chain Provenance (Chain of Custody)
              </h3>
              <p className="text-xs text-slate-400 mt-1">Verifiable history from raw extraction to point of distribution anchored by Authichain node network.</p>
            </div>

            <div className="relative pl-6 border-l-2 border-slate-800 space-y-6">
              {m.supply_chain?.map((step, idx) => (
                <div key={idx} className="relative group">
                  {/* Node Dot */}
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-950 border-2 border-emerald-400 group-hover:bg-emerald-400 transition-colors"></div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{step.stage}</span>
                      <span className="font-mono text-slate-500 text-[11px]">{step.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Icons.Globe className="w-3.5 h-3.5 text-slate-500" />
                      Location: <span className="text-slate-200">{step.location}</span>
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[11px] border-t border-slate-800/60 mt-2">
                      <span className="text-slate-500">Auditor:</span>
                      <span className="text-teal-400 font-medium">{step.certified_by}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compliance & Disassembly Tab */}
        {activeDppTab === 'compliance' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icons.AlertTriangle className="w-4 h-4 text-amber-400" />
                Chemical Safety & REACH / SVHC
              </h3>
              <dl className="divide-y divide-slate-800 text-xs">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">REACH SVHC Assessment</dt>
                  <dd className="text-emerald-400 font-mono font-medium">{m.hazardous_substances?.reach_svhc_status}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">RoHS 2 Directive Status</dt>
                  <dd className="text-emerald-400">{m.hazardous_substances?.rohs_compliant ? "Compliant" : "Non-compliant"}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-400">PFAS Clean Status</dt>
                  <dd className="text-emerald-400">{m.hazardous_substances?.pfas_free ? "PFAS-Free Certified" : "Contains PFAS"}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icons.Recycle className="w-4 h-4 text-emerald-400" />
                Circular Economy & EOL Disassembly
              </h3>
              <p className="text-xs text-slate-400">Mandatory instructions for municipal recyclers and official takeback points.</p>
              
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Takeback Program Active:</span>
                  <span className="text-emerald-400 font-semibold">{m.end_of_life?.takeback_program_active ? "Yes (EU Wide)" : "No"}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/60">
                  <span className="text-slate-400 block mb-1">Approved Recycling Hubs:</span>
                  <div className="flex flex-wrap gap-1">
                    {m.end_of_life?.recycling_centers?.map((hub, i) => (
                      <span key={i} className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300">
                        {hub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {m.end_of_life?.disassembly_guide_url && (
                <a
                  href={m.end_of_life.disassembly_guide_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center space-x-2 w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors border border-slate-700"
                >
                  <Icons.ExternalLink className="w-4 h-4 text-emerald-400" />
                  <span>Download Disassembly Manual (PDF)</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentOrchestrationStudio({ products, setProducts, setSelectedQronId }) {
  const [pipelineState, setPipelineState] = useState('IDLE'); // 'IDLE' | 'COMPLIANCE' | 'COMPLIANCE_PASSED' | 'BUILDER' | 'SUPABASE_INSERT' | 'DONE'
  const [logs, setLogs] = useState([]);
  
  // New product form state
  const [formData, setFormData] = useState({
    name: 'EcoSmart Smartwatch Series 7',
    sku: 'ES-SW7-2026',
    brand: 'EcoSmart Inc',
    category: 'Wearables & Electronics',
    carbon_footprint: '24.8',
    recycled_content: '82.5',
    repairability: '8.5',
    regulatory_std: 'EU ESPR 2024 / WEEE Directive'
  });

  const addLog = (agent, message, type = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(),
      timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
      agent,
      message,
      type
    }]);
  };

  const runOrchestration = async () => {
    setPipelineState('COMPLIANCE');
    setLogs([]);

    addLog('SYSTEM', 'Initiating Agent Orchestration sequence...', 'system');
    await new Promise(r => setTimeout(r, 600));

    // Step 1: Compliance Agent
    addLog('COMPLIANCE_AGENT', 'Evaluating payload against EU ESPR & Battery Regulations...', 'agent');
    await new Promise(r => setTimeout(r, 800));

    addLog('COMPLIANCE_AGENT', `Checking mandatory carbon metric (${formData.carbon_footprint} kg CO2e) -> VALID`, 'success');
    addLog('COMPLIANCE_AGENT', `Checking recycled content fraction (${formData.recycled_content}%) -> PASS`, 'success');
    addLog('COMPLIANCE_AGENT', 'Verifying REACH / SVHC & PFAS chemical safety criteria -> PASSED', 'success');

    setPipelineState('COMPLIANCE_PASSED');
    addLog('COMPLIANCE_AGENT', 'Compliance Agent Audit Verdict: DPP_ELIGIBLE. Triggering Builder Agent...', 'success');
    await new Promise(r => setTimeout(r, 700));

    // Step 2: Builder Agent
    setPipelineState('BUILDER');
    addLog('BUILDER_AGENT', 'Builder Agent received validation token. Constructing DPP JSONB payload...', 'agent');
    await new Promise(r => setTimeout(r, 900));

    const newQronId = `QRON-${Math.floor(1000 + Math.random() * 9000)}-DPP-${formData.brand.slice(0, 3).toUpperCase()}`;
    const hash = '0x' + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');

    addLog('BUILDER_AGENT', `Generated deterministic QRON Token ID: ${newQronId}`, 'info');
    addLog('BUILDER_AGENT', `Created cryptographic anchor hash: ${hash.slice(0, 16)}...`, 'info');

    // Step 3: Supabase Integration
    setPipelineState('SUPABASE_INSERT');
    addLog('SUPABASE_CONNECTOR', 'Executing SQL Query: INSERT INTO public.products (qron_id, metadata)...', 'db');
    await new Promise(r => setTimeout(r, 900));

    const newProduct = {
      id: `prod_dpp_${Date.now()}`,
      qron_id: newQronId,
      name: formData.name,
      sku: formData.sku,
      category: formData.category,
      brand: formData.brand,
      dpp_status: "DPP_COMPLIANT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        dpp_version: "2.1-EU-ESPR",
        regulatory_standard: formData.regulatory_std,
        dpp_compliance_status: "VERIFIED",
        compliance_agent_id: "agent_compliance_v4",
        builder_agent_id: "agent_builder_v2",
        verification_hash: hash,
        sustainability: {
          carbon_footprint_kg_co2e: parseFloat(formData.carbon_footprint),
          recycled_content_percent: parseFloat(formData.recycled_content),
          repairability_index: parseFloat(formData.repairability),
          circularity_score: 90,
          water_footprint_liters: 410,
          expected_lifespan_years: 5,
          energy_efficiency_class: "A+"
        },
        materials: [
          { name: "Recycled Recycled Titanium", percentage: 50, recycled: true, hazardous: false },
          { name: "Bio-based Elastomer Strap", percentage: 35, recycled: true, hazardous: false },
          { name: "Sapphire Glass & Micro-battery", percentage: 15, recycled: false, hazardous: true }
        ],
        hazardous_substances: {
          reach_svhc_status: "PASSED_ZERO_TOXIC",
          rohs_compliant: true,
          pfas_free: true
        },
        supply_chain: [
          { stage: "Precision Milling", location: "Zurich, Switzerland", certified_by: "Swiss Eco Cert", timestamp: new Date().toISOString().split('T')[0] },
          { stage: "Final Assembly", location: "Munich, Germany", certified_by: "TÜV SÜD", timestamp: new Date().toISOString().split('T')[0] }
        ],
        end_of_life: {
          takeback_program_active: true,
          disassembly_guide_url: "https://authichain.org/dpp/guides/smartwatch.pdf",
          recycling_centers: ["Global Micro-Electronics Hub"]
        }
      }
    };

    setProducts(prev => [newProduct, ...prev]);
    setPipelineState('DONE');
    addLog('SUPABASE_CONNECTOR', 'PostgreSQL Row Inserted successfully into products table!', 'success');
    addLog('SYSTEM', 'Orchestration Complete! Product is live in public DPP SPA.', 'system');
  };

  return (
    <div className="space-y-8">
      {/* Overview Intro Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8">
        <div className="flex items-center space-x-3 text-emerald-400 mb-2">
          <Icons.Cpu className="w-6 h-6" />
          <h2 className="text-lg font-bold text-slate-100">Agentic Orchestration Pipeline</h2>
        </div>
        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
          The <span className="text-emerald-400 font-semibold">Compliance Agent</span> audits raw product disclosures against strict EU ESPR rules. 
          Upon verification, it signals the <span className="text-teal-400 font-semibold">Builder Agent</span> to construct the standardized DPP JSONB metadata payload and write the registered asset into the Supabase <code className="text-slate-200 bg-slate-950 px-1 py-0.5 rounded font-mono">products</code> table.
        </p>

        {}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Node 1: Compliance Agent */}
          <div className={`p-4 rounded-2xl border transition-all ${
            pipelineState === 'COMPLIANCE'
              ? 'bg-emerald-500/10 border-emerald-500 text-slate-100 ring-1 ring-emerald-500'
              : pipelineState === 'COMPLIANCE_PASSED' || pipelineState === 'BUILDER' || pipelineState === 'SUPABASE_INSERT' || pipelineState === 'DONE'
              ? 'bg-slate-950 border-emerald-500/40 text-slate-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Icons.ShieldCheck className="w-4 h-4 text-emerald-400" />
                1. Compliance Agent
              </span>
              {pipelineState === 'COMPLIANCE' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full animate-pulse">Auditing...</span>}
            </div>
            <p className="text-[11px] text-slate-400">Audits sustainability standards, carbon LCA, REACH chemicals & regulatory completeness.</p>
          </div>

          {/* Node 2: Builder Agent */}
          <div className={`p-4 rounded-2xl border transition-all ${
            pipelineState === 'BUILDER'
              ? 'bg-teal-500/10 border-teal-500 text-slate-100 ring-1 ring-teal-500'
              : pipelineState === 'SUPABASE_INSERT' || pipelineState === 'DONE'
              ? 'bg-slate-950 border-teal-500/40 text-slate-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Icons.Cpu className="w-4 h-4 text-teal-400" />
                2. Builder Agent
              </span>
              {pipelineState === 'BUILDER' && <span className="text-[10px] bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full animate-pulse">Formatting...</span>}
            </div>
            <p className="text-[11px] text-slate-400">Generates QRON token ID, computes sha256 metadata hash & structures JSONB format.</p>
          </div>

          {/* Node 3: Supabase Database Sync */}
          <div className={`p-4 rounded-2xl border transition-all ${
            pipelineState === 'SUPABASE_INSERT'
              ? 'bg-cyan-500/10 border-cyan-500 text-slate-100 ring-1 ring-cyan-500'
              : pipelineState === 'DONE'
              ? 'bg-slate-950 border-cyan-500/40 text-slate-300'
              : 'bg-slate-950/60 border-slate-800 text-slate-500'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Icons.Database className="w-4 h-4 text-cyan-400" />
                3. Supabase Sync
              </span>
              {pipelineState === 'SUPABASE_INSERT' && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full animate-pulse">Writing...</span>}
            </div>
            <p className="text-[11px] text-slate-400">Persists row into <code className="font-mono text-slate-300">products</code> table & emits broadcast event.</p>
          </div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Icons.Plus className="w-4 h-4 text-emerald-400" />
            Trigger Agent Flow: Register New Product
          </h3>
          
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Product Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Brand</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={e => setFormData({...formData, brand: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">SKU</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">CO₂e Footprint (kg)</label>
                <input
                  type="number"
                  value={formData.carbon_footprint}
                  onChange={e => setFormData({...formData, carbon_footprint: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Recycled %</label>
                <input
                  type="number"
                  value={formData.recycled_content}
                  onChange={e => setFormData({...formData, recycled_content: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Repair Score (1-10)</label>
                <input
                  type="number"
                  value={formData.repairability}
                  onChange={e => setFormData({...formData, repairability: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              disabled={pipelineState !== 'IDLE' && pipelineState !== 'DONE'}
              onClick={runOrchestration}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                pipelineState !== 'IDLE' && pipelineState !== 'DONE'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20'
              }`}
            >
              <Icons.Play className="w-4 h-4 fill-current" />
              <span>
                {pipelineState === 'IDLE' || pipelineState === 'DONE'
                  ? 'Trigger Agent Orchestration Flow'
                  : 'Orchestrating Agents...'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Execution Logs Terminal */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col h-[400px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Agent Console Execution Stream
            </span>
            <span className="text-[10px] font-mono text-slate-500">WebSocket: Connected</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] pr-2">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic">Click "Trigger Agent Orchestration Flow" to begin agent logs...</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-start space-x-2">
                  <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                  <span className={`font-bold ${
                    log.agent === 'COMPLIANCE_AGENT' ? 'text-emerald-400' :
                    log.agent === 'BUILDER_AGENT' ? 'text-teal-400' :
                    log.agent === 'SUPABASE_CONNECTOR' ? 'text-cyan-400' : 'text-slate-400'
                  }`}>
                    [{log.agent}]:
                  </span>
                  <span className={log.type === 'success' ? 'text-emerald-300' : 'text-slate-300'}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>

          {pipelineState === 'DONE' && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold">✓ Asset Successfully Created in Supabase!</span>
              <button
                onClick={() => setSelectedQronId(products[0].qron_id)}
                className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
              >
                View Live DPP SPA →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupabaseSchemaViewer({ copyToClipboard, copiedText }) {
  const sqlMigration = `-- SQL Migration for Authichain Products DPP JSONB Metadata
-- 1. Ensure extension for fast JSON queries
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Products table definition with JSONB metadata column
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qron_id VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(128) NOT NULL,
    brand VARCHAR(128) NOT NULL,
    category VARCHAR(128) NOT NULL,
    dpp_status VARCHAR(32) DEFAULT 'DPP_COMPLIANT',
    
    -- Mandatory DPP metadata JSONB field holding EU compliance attributes
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. GIN Index for fast nested JSON search on regulatory metrics
CREATE INDEX IF NOT EXISTS idx_products_dpp_metadata 
ON public.products USING GIN (metadata jsonb_path_ops);

-- 4. Sample Query by Compliance Agent / Builder Agent
SELECT name, qron_id, metadata->'sustainability'->>'carbon_footprint_kg_co2e' AS carbon
FROM public.products
WHERE metadata->>'dpp_compliance_status' = 'VERIFIED';`;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8">
        <div className="flex items-center space-x-3 text-teal-400 mb-2">
          <Icons.Database className="w-6 h-6" />
          <h2 className="text-lg font-bold text-slate-100">Supabase Schema & Metadata Specification</h2>
        </div>
        <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
          The <code className="text-emerald-400 font-mono">products</code> table in Supabase leverages PostgreSQL <code className="text-emerald-400 font-mono">JSONB</code> storage to allow flexible, versioned regulatory metadata while maintaining query indexing speed.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
            <Icons.FileText className="w-4 h-4 text-emerald-400" />
            PostgreSQL SQL Migration (supabase/migrations/20260827_dpp_products.sql)
          </h3>
          <button
            onClick={() => copyToClipboard(sqlMigration, 'sql')}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Icons.Copy className="w-3.5 h-3.5" />
            <span>{copiedText === 'sql' ? 'Copied!' : 'Copy SQL Script'}</span>
          </button>
        </div>

        <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed">
          {sqlMigration}
        </pre>
      </div>
    </div>
  );
}

function AssetInventoryTable({ products, onSelectProduct }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Icons.Layers className="w-5 h-5 text-emerald-400" />
          Registered Supabase Products Inventory
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          All products stored in the Supabase <code className="text-emerald-400 font-mono">products</code> table with DPP JSONB payloads.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4">QRON ID</th>
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4">CO₂e Impact</th>
              <th className="py-3 px-4">Recycled %</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {products.map(p => {
              const meta = p.metadata || {};
              const s = meta.sustainability || {};
              return (
                <tr key={p.qron_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-emerald-400">{p.qron_id}</td>
                  <td className="py-3 px-4 font-medium text-slate-200">{p.name}</td>
                  <td className="py-3 px-4 text-slate-400">{p.brand}</td>
                  <td className="py-3 px-4 font-mono text-slate-300">{s.carbon_footprint_kg_co2e ?? '-'} kg</td>
                  <td className="py-3 px-4 font-mono text-emerald-400">{s.recycled_content_percent ?? '-'}%</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {meta.dpp_compliance_status || 'VERIFIED'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onSelectProduct(p.qron_id)}
                      className="px-3 py-1 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1"
                    >
                      <span>Inspect Passport</span>
                      <Icons.ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}