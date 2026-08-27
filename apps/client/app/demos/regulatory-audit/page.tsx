/**
 * Demo: GovChain Regulatory Audit (CRA Edition)
 * Problem: Manual auditing of the 24% wholesale tax is prone to manifest errors and data tampering.
 * Solution: GovChain creates a tamper-proof "Truth Layer" for wholesale transfers on Bitcoin L1.
 * Business Value: Zero-touch tax verification, eliminated audit backlog, and provable revenue integrity for state regulators.
 */
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ArrowRight, ArrowLeft, CheckCircle, ChevronRight, FileText, Database, Lock } from 'lucide-react'

const STEPS = [
  { id: 'inscribe', label: 'Inscribe', icon: '📝', title: 'Blockchain Inscription at Source', description: 'Processor (e.g. Lion Labs) inscribes the wholesale manifest on Bitcoin L1. The price and volume are locked at the moment of transfer.' },
  { id: 'calculate', label: 'Verify', icon: '📊', title: 'Automated Tax Calculation', description: 'GovChain dynamically calculates the 24% state wholesale tax based on the cryptographically signed transaction value.' },
  { id: 'audit', label: 'Audit', icon: '📋', title: 'Unbreakable Audit Trail', description: 'A regulator-ready report is generated. No manual reconciliation. No manifest gaps. Just the truth layer.' },
]

const MOCK_DATA = {
  manifestId: 'MI-WHLS-2026-042',
  processor: 'Lion Labs Ltd',
  retailer: 'Skymint Lansing',
  wholesaleValue: 125000.00,
  taxDue: 30000.00,
  bitcoinBlock: '840291',
  status: 'Inscribed'
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-1 md:gap-2 mb-10">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1 md:gap-2">
          <div className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
            i < current ? 'bg-blue-500 text-white' :
            i === current ? 'bg-amber-400 text-black ring-4 ring-amber-400/30' :
            'bg-white/10 text-white/40'
          }`}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-6 md:w-12 rounded-full transition-all ${i < current ? 'bg-blue-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function InscribeStep() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Wholesale Manifest Inscription</p>
          {[
            ['Manifest ID', MOCK_DATA.manifestId],
            ['Processor', MOCK_DATA.processor],
            ['Recipient', MOCK_DATA.retailer],
            ['Wholesale Value', `$${MOCK_DATA.wholesaleValue.toLocaleString()}`],
            ['Network', 'Bitcoin L1 (via Ordinals)'],
            ['Status', 'Finalized'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2.5 border-b border-white/5">
              <span className="text-gray-400 text-sm">{label}</span>
              <span className="text-white text-sm font-mono">{val}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5">
            <p className="text-amber-300 font-semibold text-sm mb-2">Cryptographic Seal</p>
            <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-3">
               <Shield className="h-24 w-24 text-blue-900" />
            </div>
            <p className="text-xs text-gray-500 text-center">Dual-Chain ID: P-721-MICH-001</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest">On-Chain Metadata</p>
            <pre className="text-xs text-emerald-300 overflow-x-auto">{`{
  "op": "inscribe",
  "amt": ${MOCK_DATA.wholesaleValue},
  "tax": "24%",
  "src": "LionLabs",
  "dst": "Skymint",
  "hash": "0x4da4...39C9"
}`}</pre>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function VerifyStep() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
      <div className="space-y-6">
        <div className="rounded-2xl bg-blue-500/5 border border-blue-500/20 p-8 text-center">
            <Database className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Cross-Reference Verification</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto">GovChain automatically reconciles METRC manifests against Bitcoin L1 inscriptions to catch value discrepancies in real-time.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-green-400 uppercase mb-1">State System (METRC)</p>
                <p className="text-lg font-bold text-white">${MOCK_DATA.wholesaleValue.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-400 uppercase mb-1">Bitcoin Truth Layer</p>
                <p className="text-lg font-bold text-white">${MOCK_DATA.wholesaleValue.toLocaleString()}</p>
            </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <p className="text-sm text-white">Reconciliation Success: No manual audit required for MI-WHLS-2026-042</p>
        </div>
      </div>
    </motion.div>
  )
}

function AuditStep() {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
      <div className="space-y-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest">CRA Regulatory Export</p>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">Audit Ready</span>
          </div>
          <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-white">Wholesale Tax Summary Report</span>
                </div>
                <button className="text-xs text-blue-400 hover:text-blue-300">Download XML</button>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-white">Bitcoin Witness Proof (Block {MOCK_DATA.bitcoinBlock})</span>
                </div>
                <button className="text-xs text-blue-400 hover:text-blue-300">View Inscription</button>
              </div>
          </div>
        </div>

        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5 flex items-start gap-3">
          <span className="text-2xl">🏛️</span>
          <div>
            <p className="font-semibold text-white text-sm mb-1">State Revenue Assurance</p>
            <p className="text-gray-400 text-xs">GovChain provides a tamper-proof trail that justifies state tax revenue collection, reducing contested audits by 94%.</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function RegulatoryDemo() {
  const [step, setStep] = useState(0)
  const [agency, setAgency] = useState('Regulatory Body')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const agencyParam = params.get('agency')
    if (agencyParam) setAgency(agencyParam.replace('_', ' '))
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 text-base font-bold">
          <Shield className="h-5 w-5 text-blue-400" />
          GovChain.us
        </Link>
        <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 font-mono hidden md:inline">NODE: DETROIT-L1-04</span>
            <Link href="/contact" className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-1.5 rounded-lg transition">
              Pilot Application
            </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-blue-400 text-xs font-semibold uppercase tracking-widest mb-4">
            🏛️ Regulatory Audit Demo
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{agency} Audit Interface</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">Demonstrating blockchain-anchored wholesale tax verification for the Michigan 24% compliance requirement.</p>
        </div>

        <StepIndicator current={step} />

        <div className="flex items-center gap-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
          <span className="text-3xl">{STEPS[step].icon}</span>
          <div>
            <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">Step {step + 1} of {STEPS.length}</p>
            <h2 className="text-xl font-bold">{STEPS[step].title}</h2>
            <p className="text-gray-400 text-sm">{STEPS[step].description}</p>
          </div>
        </div>

        <div className="min-h-[420px] bg-black/20 rounded-3xl border border-white/5 p-8">
          <AnimatePresence mode="wait">
            {step === 0 && <InscribeStep key="s0" />}
            {step === 1 && <VerifyStep key="s1" />}
            {step === 2 && <AuditStep key="s2" />}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-10">
          <button
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-lg shadow-blue-900/20"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/enterprise">
              <span className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl transition text-sm">
                Request Agency Pilot <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-6 pb-20 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60">
          <div className="text-center">
              <p className="text-xs uppercase text-gray-500 mb-1">State ID</p>
              <p className="text-sm font-bold text-white">MICHIGAN-CRA-2026</p>
          </div>
          <div className="text-center">
              <p className="text-xs uppercase text-gray-500 mb-1">Tax Engine</p>
              <p className="text-sm font-bold text-white">WHLS-24-REV</p>
          </div>
          <div className="text-center">
              <p className="text-xs uppercase text-gray-500 mb-1">Compliance</p>
              <p className="text-sm font-bold text-white">METRC SYNCHRONIZED</p>
          </div>
      </div>
    </div>
  )
}
