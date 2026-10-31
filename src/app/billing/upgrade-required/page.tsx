import Link from "next/link";
import { accessDeniedMessage } from "../../../lib/compliance-access";
import { COMPLIANCE_PLAN_ID, planPaymentLink } from "../../../lib/plans";

export const metadata = {
  title: "Enterprise Compliance",
  robots: { index: false, follow: false },
};

/**
 * Shown when /dashboard/compliance refuses access (src/lib/compliance-dal.ts).
 *
 * The previous version told every visitor that their "FDA / EUDAMED logging"
 * was suspended and that audit flags would fire, and linked to a checkout at
 * billing.authichain.com that nothing else in the repo knows about. None of
 * that was true. This page says why access was refused and only offers a
 * checkout once the tier is actually sellable in src/lib/plans.ts.
 */
export default async function UpgradeRequiredPage({
  searchParams,
}: {
  // Next.js App Router: searchParams is a Promise that must be awaited.
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const checkoutUrl = planPaymentLink(COMPLIANCE_PLAN_ID);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100 sm:px-6">
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl sm:p-8">
        <h1 className="mb-4 text-xl font-bold tracking-tight">
          Enterprise Compliance
        </h1>

        <p className="mb-6 text-sm leading-relaxed text-slate-300">
          {accessDeniedMessage(reason)}
        </p>

        <div className="mb-8 space-y-2 rounded-lg border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
          <p className="font-semibold text-slate-100">What the tier includes</p>
          <p>
            • Every Digital Product Passport your account has published, in one
            place.
          </p>
          <p>
            • Each product category&apos;s EU obligation: law with a fixed date,
            expected, or none.
          </p>
          <p>
            • The next EU regulatory milestone and a verification link per
            passport.
          </p>
        </div>

        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="block w-full rounded-lg bg-slate-100 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white"
          >
            Subscribe to Enterprise Compliance
          </a>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-400">
              Enterprise Compliance is not on sale yet. Talk to us about early
              access, or see the plans available today.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/contact"
                className="flex-1 rounded-lg bg-slate-100 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white"
              >
                Ask about early access
              </Link>
              <Link
                href="/pricing"
                className="flex-1 rounded-lg border border-slate-700 py-3 text-center text-sm font-semibold text-slate-200 hover:border-slate-500"
              >
                See current plans
              </Link>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          Already subscribed? Sign in with the email you paid with.
        </p>
      </div>
    </div>
  );
}
