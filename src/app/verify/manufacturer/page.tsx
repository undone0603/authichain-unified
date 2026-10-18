// src/app/verify/manufacturer/page.tsx
'use client';

import { useState } from 'react';

const ENDPOINT = '/api/manufacturer-status'; // proxy or full Worker URL
const CONTRACT = '0x4da4D2675e52374639C9c954f4f653887A9972BE';

type HistoryItem = {
  type: 'granted' | 'revoked' | 'manufacturer_verified' | 'manufacturer_revoked';
  block: string;
  tx: string;
  role: string;
  sender: string;
  timestamp: string | null;
};

type Response = {
  address: string;
  contract: string;
  chainId: number;
  currentBlock: string | null;
  history: HistoryItem[];
  polygonscan: {
    contract: string;
    address: string;
    logs: string;
  };
  disclaimer: string;
  source: string;
  error?: string;
  historyError?: string;
  current?: {
    admin: boolean;
    minter: boolean;
    updater: boolean;
    pauser: boolean;
    manufacturerVerified: boolean;
  };
};

export default function ManufacturerStatus() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError('Enter a valid 0x address');
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    console.log(JSON.stringify({ event: 'history_query_submitted', address: trimmed }));

    try {
      const res = await fetch(`${ENDPOINT}/${trimmed}/history`);
      const json: Response = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `HTTP ${res.status}`);
      } else {
        setData(json);
        console.log(JSON.stringify({ event: 'history_loaded', event_count: json.history?.length ?? 0 }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Manufacturer Role History</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Role and manufacturer events for AuthiChainNFT on Polygon, limited to the latest 10,000 blocks the free RPC will return. manufacturerVerified is an admin-set contract flag, not a certificate.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="0x..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 border rounded px-3 py-2 font-mono text-sm"
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        <button
          onClick={check}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Check history'}
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4 text-sm">
          <div className="border rounded p-4 space-y-1 font-mono">
            <div>Address: {data.address}</div>
            <div>Contract: {data.contract}</div>
            <div>Current block: {data.currentBlock ?? 'unavailable'}</div>
            <div>
              <a href={data.polygonscan.contract} target="_blank" rel="noreferrer" className="underline">
                PolygonScan contract
              </a>
              {' · '}
              <a href={data.polygonscan.address} target="_blank" rel="noreferrer" className="underline">
                Address
              </a>
              {' · '}
              <a href={data.polygonscan.logs} target="_blank" rel="noreferrer" className="underline">
                Events
              </a>
            </div>
          </div>

          {data.current && (
            <div className="border rounded p-4 space-y-1">
              <h2 className="font-medium">Current roles</h2>
              <div>Admin: {data.current.admin ? 'yes' : 'no'}</div>
              <div>Minter: {data.current.minter ? 'yes' : 'no'}</div>
              <div>Updater: {data.current.updater ? 'yes' : 'no'}</div>
              <div>Pauser: {data.current.pauser ? 'yes' : 'no'}</div>
              <div>Manufacturer verified: {data.current.manufacturerVerified ? 'yes' : 'no'}</div>
            </div>
          )}

          <div>
            <h2 className="font-medium mb-2">Role history ({data.history.length})</h2>
            {data.historyError && (
              <p className="text-neutral-500">The event list for this window was not available ({data.historyError}). Current role flags above still come from the contract.</p>
            )}
            {!data.historyError && data.history.length === 0 ? (
              <p className="text-neutral-500">No role or manufacturer events in the latest 10,000 blocks. That does not mean the address holds no role.</p>
            ) : data.history.length > 0 ? (
              <ul className="space-y-2">
                {data.history.map((item, i) => {
                  const tx = /^0x[a-fA-F0-9]{64}$/.test(item.tx) ? item.tx : '';
                  return (
                  <li key={i} className="border rounded p-3 font-mono text-xs">
                    <div className={item.type === 'granted' || item.type === 'manufacturer_verified' ? 'text-green-700' : 'text-red-700'}>
                      {item.type === 'manufacturer_verified'
                        ? 'MANUFACTURER VERIFIED'
                        : item.type === 'manufacturer_revoked'
                          ? 'MANUFACTURER REVOKED'
                          : item.type.toUpperCase()}{' '}
                      · block {item.block}
                    </div>
                    {item.role ? <div>Role: {item.role}</div> : null}
                    {item.sender ? <div>Sender: {item.sender}</div> : null}
                    {item.timestamp ? <div>Contract timestamp: {item.timestamp}</div> : null}
                    {tx ? (
                    <div>
                      Tx:{' '}
                      <a
                        href={`https://polygonscan.com/tx/${tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {tx.slice(0, 10)}…{tx.slice(-8)}
                      </a>
                    </div>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="text-xs text-neutral-500 border-t pt-3">
            {data.disclaimer}
          </div>
          <div className="text-xs text-neutral-400">{data.source}</div>

          <p className="pt-4 border-t text-xs text-neutral-500">
            A role event is an access-control log for this NFT contract. It is not a product passport, and this page does not take payment.
          </p>
        </div>
      )}

      <footer className="text-xs text-neutral-400">
        Contract: {CONTRACT} · No account required · Results are live contract reads
      </footer>
    </div>
  );
}
