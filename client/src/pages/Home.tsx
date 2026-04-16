import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useBrand } from "@/contexts/BrandContext";

// Each brand ships its own landing. Lazy so any one landing is the only
// JS that ships on a given domain.
const AuthiChainHome  = lazy(() => import("./brand/AuthiChainHome"));
const QronHome        = lazy(() => import("./brand/QronHome"));
const StrainChainHome = lazy(() => import("./brand/StrainChainHome"));
const GovChainHome    = lazy(() => import("./brand/GovChainHome"));

function LandingLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Brand dispatcher for `/`. Reads the active brand from BrandContext
 * (which is resolved server-side from Host, or client-side from
 * `location.hostname`) and renders the matching landing page.
 */
export default function Home() {
  const { brandId } = useBrand();

  return (
    <Suspense fallback={<LandingLoader />}>
      {brandId === "qron"        && <QronHome />}
      {brandId === "strainchain" && <StrainChainHome />}
      {brandId === "govchain"    && <GovChainHome />}
      {brandId === "authichain"  && <AuthiChainHome />}
    </Suspense>
  );
}
