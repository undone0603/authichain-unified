'use client';
import dynamic from 'next/dynamic';

// Dynamically import the BrowserApp component and disable SSR
const ClientOnlyBrowser = dynamic(() => import('./BrowserApp'), { 
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">
      <div className="flex gap-2 items-center">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <span>Initializing AgentZ Swarm Interface...</span>
      </div>
    </div>
  )
});

export default function Page() {
  return <ClientOnlyBrowser />;
}