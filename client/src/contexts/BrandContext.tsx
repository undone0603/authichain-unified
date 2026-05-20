import React, { createContext, useContext, useEffect, useMemo } from "react";
import { BRANDS, DEFAULT_BRAND, resolveBrand, type Brand, type BrandId } from "@shared/brands";

declare global {
  interface Window {
    __BRAND__?: BrandId;
  }
}

interface BrandContextValue {
  brandId: BrandId;
  brand:   Brand;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

function detectBrand(): BrandId {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  // Server-injected (preferred — see server/_core/brand-middleware.ts)
  if (window.__BRAND__ && BRANDS[window.__BRAND__]) return window.__BRAND__;
  // Fallback: resolve from current hostname client-side
  return resolveBrand(window.location.hostname);
}

export function BrandProvider({ children }: { children: React.ReactNode }) {
  // Brand is determined once at mount; changing domains requires a full reload
  // anyway, so there's no need for setState.
  const brandId = useMemo(detectBrand, []);
  const brand = BRANDS[brandId];

  useEffect(() => {
    // Keep the <html data-brand="..."> attribute in sync with the resolved
    // brand so Tailwind `data-[brand=qron]:...` variants work. The inline
    // script in index.html sets this pre-mount; we re-apply here in case
    // the attribute was stripped or the brand id changed post-hydration.
    document.documentElement.setAttribute("data-brand", brandId);
    document.title = `${brand.displayName} — ${brand.tagline}`;
  }, [brandId, brand]);

  const value = useMemo<BrandContextValue>(() => ({ brandId, brand }), [brandId, brand]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within a BrandProvider");
  return ctx;
}
