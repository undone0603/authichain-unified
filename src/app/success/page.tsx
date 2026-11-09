/**
 * QRON/Stripe redirects can reach this page even when payment is pending.
 * Never tell a buyer an order or asset was activated from the URL alone.
 */
export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold">Checkout status unavailable</h1>
        <p className="mt-4 text-zinc-400">
          This page cannot verify that your payment completed or that any
          QR asset, redirect, or account credit has been delivered.
          Check your payment confirmation and your account before relying
          on an order. Contact support if your payment succeeded but delivery
          is not visible.
        </p>
        <a
          href="/pricing"
          className="mt-8 inline-block rounded-lg border border-zinc-500 px-5 py-3 font-semibold"
        >
          View plans
        </a>
      </div>
    </main>
  );
}
