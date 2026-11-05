import Link from "next/link";

/**
 * The redirect page cannot know whether Stripe has settled or a product was
 * fulfilled. Only the webhook + server-side entitlement checks may say so.
 */
export default function SuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-16 text-white">
      <section className="w-full max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-cyan-300">
          Checkout status unverified
        </p>
        <h1 className="mt-4 text-3xl font-bold">
          We cannot confirm payment here
        </h1>
        <p className="mt-6 text-zinc-400">
          A checkout redirect is not payment or delivery proof. If you paid,
          use your confirmation email and account dashboard to check your
          order. Fulfillment and access are only confirmed by the secure
          payment and entitlement services.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-black"
          >
            Check dashboard
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-600 px-5 py-3 font-semibold"
          >
            Back to AuthiChain
          </Link>
        </div>
      </section>
    </main>
  );
}
