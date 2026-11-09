/**
 * A Stripe return URL is never a receipt. Activation remains available only
 * through the separately verified merchant activation flow.
 */
export default function DppThanksPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
          Checkout return
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Payment status not verified
        </h1>
        <p className="mt-4 text-zinc-400">
          Returning from checkout, or having a session reference, does not
          confirm a payment, an entitlement, an activation email, or access
          to a workspace. Use your verified activation instructions after
          payment processing completes. Contact support if you need help.
        </p>
        <a href="/pricing" className="mt-8 inline-flex rounded-lg bg-cyan-300
          px-5 py-3 font-semibold text-black">View plans</a>
      </div>
    </main>
  );
}
