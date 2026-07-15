'use client';
import { useState } from 'react';

export default function StrainChainDemo() {
  const [step, setStep] = useState<'initial' | 'scanning' | 'verified'>('initial');

  const simulateScan = () => {
    setStep('scanning');
    setTimeout(() => setStep('verified'), 1800); // Sub-2-second latency
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full border border-gray-800 rounded-3xl p-8 bg-gray-950 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-green-500">StrainChain</h1>
          <p className="text-sm text-gray-400 mt-1">Live Interactive Demo</p>
        </div>

        {/* Dynamic Content */}
        {step === 'initial' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-48 h-48 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center mb-8">
              <div className="text-gray-500 text-sm">QR Viewfinder</div>
            </div>
            <button
              onClick={simulateScan}
              className="w-full py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all"
            >
              Simulate TruMark Scan
            </button>
          </div>
        )}

        {step === 'scanning' && (
          <div className="flex flex-col items-center animate-pulse">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-green-500 font-mono text-sm">Verifying cryptographic hash on Polygon...</p>
            <p className="text-gray-500 font-mono text-xs mt-2">Latency: 1.2s</p>
          </div>
        )}

        {step === 'verified' && (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-xl font-bold mb-1">Authentic Product</h2>
            <p className="text-gray-400 text-sm mb-6">Verified by StrainChain</p>

            <div className="w-full bg-gray-900 rounded-xl p-4 mb-6 border border-gray-800">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500 text-xs uppercase">Brand</span>
                <span className="text-white text-sm font-semibold">Exotic Matter</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500 text-xs uppercase">Strain</span>
                <span className="text-white text-sm font-semibold">MAC 1 (Pre-pack)</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-500 text-xs uppercase">METRC Tag</span>
                <span className="text-white text-sm font-mono truncate max-w-[120px]">1A40503000...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs uppercase">Blockchain Tx</span>
                <span className="text-blue-400 text-sm font-mono truncate max-w-[120px]">0x7F...3b9A</span>
              </div>
            </div>

            <button
              onClick={() => setStep('initial')}
              className="w-full py-3 border border-gray-700 text-gray-300 font-bold rounded-full hover:bg-gray-800 transition-all"
            >
              Reset Demo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
