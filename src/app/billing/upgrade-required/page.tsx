import React from 'react';

export default async function UpgradeRequiredPage({
  searchParams,
}: {
  // Next.js 15 App Router: searchParams is a Promise that must be awaited.
  searchParams: Promise<{ orgId?: string }>;
}) {
  const { orgId = '' } = await searchParams;
  const stripePortalLink = `https://billing.authichain.com/checkout?client_reference_id=${orgId}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-xl rounded-xl border border-rose-900/50 bg-rose-950/10 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 flex items-center space-x-3 text-rose-500">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-xl font-bold tracking-tight">FDA / EUDAMED Logging Suspended</h1>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-400">
          Your organization's access to the <span className="font-semibold text-slate-200">BrandContext Multi-Tenant Middleware</span> has dropped to an inactive state. Active logging of production supply chain digital twins and serialization matrices is currently paused for this tenant.
        </p>

        <div className="mb-8 rounded-lg bg-slate-900/80 p-4 border border-slate-800 text-xs text-slate-400 space-y-2">
          <p className="font-semibold text-rose-400 text-sm">⚠️ Pending Audit Risk:</p>
          <p>• Immediate data drops on all active API requests matching your tenant key.</p>
          <p>• Inability to pull structured chapter logs via the Knight’s Tale provenance engine.</p>
          <p>• Non-compliance flags will trigger on external regulatory audit pings.</p>
        </div>

        <a
          href={stripePortalLink}
          className="block w-full rounded-lg bg-rose-600 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-600/20 active:scale-[0.99]"
        >
          Authorize Enterprise Compliance Tier
        </a>
        
        <p className="mt-4 text-center text-[11px] text-slate-500">
          Secure onboarding handled directly via the edge network. Zero external data tracking.
        </p>
      </div>
    </div>
  );
}
