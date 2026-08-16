import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BRANDS, DEFAULT_BRAND, resolveBrand, type BrandId } from "@shared/brands";

const AuthiChainHome = lazy(() => import("./AuthiChainHome"));
const QronHome = lazy(() => import("./QronHome"));
const StrainChainHome = lazy(() => import("./StrainChainHome"));
const GovChainHome = lazy(() => import("./GovChainHome"));

// Mirrors BrandContext.detectBrand. Kept local (not the useBrand hook) so "/"
// resolves the brand even though <BrandProvider> is not currently mounted in
// the app tree: prefer the server-injected window.__BRAND__, else derive it
// from the current hostname (qron.space -> qron, govchain.us -> govchain, ...).
function detectBrand(): BrandId {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  if (window.__BRAND__ && BRANDS[window.__BRAND__]) return window.__BRAND__;
  return resolveBrand(window.location.hostname);
}

const HOMES = {
  authichain: AuthiChainHome,
  qron: QronHome,
  strainchain: StrainChainHome,
  govchain: GovChainHome,
} satisfies Record<BrandId, unknown>;

/**
 * Dispatches the "/" route to the brand home matching the current domain.
 * Previously "/" was hardcoded to AuthiChainHome, so every domain showed the
 * AuthiChain home; this renders QronHome on qron.space, GovChainHome on
 * govchain.us, StrainChainHome on strainchain.io, AuthiChainHome otherwise (D2).
 */
export default function BrandHome() {
  const Home = HOMES[detectBrand()] ?? AuthiChainHome;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}
