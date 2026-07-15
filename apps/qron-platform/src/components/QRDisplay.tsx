'use client';

import { useState } from 'react';
import { GeneratedQRON, QRONMode, ScanResult } from '@/lib/types';
import {
  Download,
  Share2,
  Wallet,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ShieldX,
  ScanLine,
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useActiveAccount } from 'thirdweb/react';
import { ConnectButton } from 'thirdweb/react';
import { thirdwebClient, activeChain } from '@/lib/thirdweb';
import { createWallet, inAppWallet } from 'thirdweb/wallets';

const wallets = [
  inAppWallet(),
  createWallet('io.metamask'),
  createWallet('com.coinbase.wallet'),
  createWallet('me.rainbow'),
];

interface QRDisplayProps {
  qron: GeneratedQRON | null;
  isGenerating: boolean;
  mode: QRONMode;
}

export function QRDisplay({ qron, isGenerating, mode }: QRDisplayProps) {
  const account = useActiveAccount();
  const [minting, setMinting] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const handleDownload = async () => {
    if (!qron?.imageUrl) return;
    try {
      const response = await fetch(qron.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qron-${qron.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded!');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleShare = async () => {
    if (!qron?.imageUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My QRON',
          text: 'Check out this AI-generated QR code!',
          url: qron.imageUrl,
        });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(qron.imageUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleScanValidate = async () => {
    if (!qron?.imageUrl || !qron.registration_id) {
            toast.error('No registration ID — generate a new QRON first');
      return;
    }

    setScanning(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/qron/scan-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_url: qron.imageUrl,
          registration_id: qron.registration_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Scan validation failed');

      setScanResult(data);

      if (data.scannable) {
        toast.success(`QR verified! Decoded: ${data.decoded?.slice(0, 50)}...`);
      } else {
        toast.error('QR code is not scannable. Try regenerating.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan validation failed';
      toast.error(message);
    } finally {
      setScanning(false);
    }
  };

  const handleMint = async () => {
    if (!qron) return;
    if (!account?.address) return;

    setMinting(true);
    try {
      const res = await fetch('/api/qron/mint-nft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: account.address,
          imageUrl: qron.imageUrl,
          destinationUrl: qron.destinationUrl,
          qronId: qron.id,
          registration_id: qron.registration_id,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Mint failed');

      setMintedTokenId(data.txHash ?? 'minted');
      toast.success('NFT minted to your wallet!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Minting failed';
      toast.error(message);
    } finally {
      setMinting(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="protocol-card h-full min-h-[400px] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-48 h-48 border-4 border-zinc-700 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-gold animate-spin" />
          </div>
          <div className="absolute inset-0 bg-gold/20 rounded-2xl animate-pulse" />
        </div>
        <p className="mt-4 text-slate-400">Generating your QRON...</p>
        <p className="text-sm text-slate-500 mt-1">This may take 10-30 seconds</p>
      </div>
    );
  }

  if (!qron) {
    return (
      <div className="protocol-card h-full min-h-[400px] flex flex-col items-center justify-center text-center">
        <div className="w-48 h-48 border-2 border-dashed border-zinc-600 rounded-2xl flex items-center justify-center mb-4">
          <div className="text-slate-500">
            <svg
              className="w-16 h-16 mx-auto mb-2 opacity-50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3z" />
              <path d="M18 18h3v3h-3z" />
              <path d="M14 18h3v3h-3z" />
              <path d="M18 14h3v3h-3z" />
            </svg>
          </div>
        </div>
        <h3 className="text-lg font-medium text-slate-300">Your QRON Preview</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Enter a URL and click Generate to create your AI-powered QR code
        </p>
      </div>
    );
  }

  return (
    <div className="protocol-card">
      {/* QR Code Image */}
      <div className="relative aspect-square max-w-sm mx-auto mb-6 rounded-xl overflow-hidden qr-container">
        <Image
          src={qron.imageUrl}
          alt="Generated QRON"
          fill
          className="object-cover"
          priority
        />
        {mode === 'holographic' && (
          <div className="absolute inset-0 holographic opacity-30 pointer-events-none" />
        )}

        {/* Scan badge overlay */}
        {scanResult && (
          <div
            className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              scanResult.scannable
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
            }`}
          >
            {scanResult.scannable ? (
              <ShieldCheck className="w-3 h-3" />
            ) : (
              <ShieldX className="w-3 h-3" />
            )}
            {scanResult.scannable ? 'Scan Safe' : 'Not Scannable'}
          </div>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleDownload}
          className="btn-outline-gold flex-1 flex items-center justify-center gap-2 py-2.5 text-sm"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        <button
          onClick={handleShare}
          className="btn-outline-gold flex-1 flex items-center justify-center gap-2 py-2.5 text-sm"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* Scan Validation Button */}
      {qron.registration_id && !scanResult && (
        <button
          onClick={handleScanValidate}
          disabled={scanning}
          className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all bg-zinc-800 text-slate-300 hover:bg-zinc-700 border border-zinc-600 disabled:opacity-60"
        >
          {scanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Validating scan...
            </>
          ) : (
            <>
              <ScanLine className="w-4 h-4" />
              Verify QR Scannability
            </>
          )}
        </button>
      )}

      {/* Scan Result Detail */}
      {scanResult && (
        <div
          className={`mb-3 p-3 rounded-lg text-sm ${
            scanResult.scannable
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {scanResult.scannable ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldX className="w-4 h-4" />
            )}
            <span className="font-semibold">
              {scanResult.scannable ? 'QR Code Verified' : 'QR Not Scannable'}
            </span>
          </div>
          {scanResult.decoded && (
            <p className="text-xs font-mono opacity-80 truncate">
              Decoded: {scanResult.decoded}
            </p>
          )}
          <p className="text-xs opacity-70 mt-1">
            Confidence: {(scanResult.confidence * 100).toFixed(0)}%
          </p>
        </div>
      )}

      {/* Mint NFT Section */}
      <div className="flex gap-2 mb-4">
        {mintedTokenId ? (
          <div className="w-full flex items-center justify-center gap-2 text-sm text-green-400 font-medium py-2">
            <CheckCircle2 className="w-4 h-4" />
            NFT Minted Successfully!
          </div>
        ) : account?.address ? (
          <button
            onClick={handleMint}
            disabled={minting || (scanResult !== null && !scanResult.scannable)}
            className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-60 py-2.5 text-sm"
          >
            {minting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4" />
            )}
            {minting ? 'Minting...' : 'Mint as NFT'}
          </button>
        ) : (
          <div className="w-full">
            <ConnectButton
              client={thirdwebClient}
              chain={activeChain}
              wallets={wallets}
              connectButton={{
                label: 'Connect Wallet to Mint',
                style: {
                  width: '100%',
                  background: 'linear-gradient(135deg, #c9a227, #a07c10)',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: 'none',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  height: 'auto',
                  minHeight: 'unset',
                },
              }}
            />
          </div>
        )}
      </div>

      {/* Mint success detail */}
      {mintedTokenId && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-400">
          <p className="font-semibold mb-1">NFT minted successfully</p>
          <p className="text-xs font-mono break-all opacity-80">
            {mintedTokenId}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-slate-400">
          <span>Target URL</span>
          <a
            href={qron.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gold-text hover:underline flex items-center gap-1"
          >
            {qron.destinationUrl ? new URL(qron.destinationUrl).hostname : ''}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Mode</span>
          <span className="text-slate-300 capitalize">{mode}</span>
        </div>
        {qron.registration_id && (
          <div className="flex justify-between text-slate-400">
            <span>Provenance</span>
            <span className="text-green-400 text-xs font-mono">
              {qron.registration_id.slice(0, 8)}...
            </span>
          </div>
        )}
        {account?.address && (
          <div className="flex justify-between text-slate-400">
            <span>Wallet</span>
            <span className="text-slate-300 font-mono text-xs">
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
