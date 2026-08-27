import { BRAND_IDS, BRANDS, type BrandId } from "@shared/brands";
import { useBrand } from "@/contexts/BrandContext";

/**
 * Cross-brand navigation strip. Renders all four ecosystem domains
 * (AuthiChain, QRON, StrainChain, GovChain) and highlights the currently
 * active brand. Use either as a compact footer row (`variant="footer"`)
 * or as a top-of-page ribbon (`variant="ribbon"`).
 *
 * Hostnames are hard-coded from shared/brands.ts so these always route
 * across domains, not within the current SPA.
 */
export function EcosystemNav({ variant = "footer" }: { variant?: "footer" | "ribbon" }) {
  const { brandId: active } = useBrand();

  if (variant === "ribbon") {
    return (
      <div className="w-full border-b border-border/40 bg-background/60 backdrop-blur-sm text-xs">
        <div className="container flex items-center justify-center gap-4 py-2 text-muted-foreground">
          <span className="hidden sm:inline">The ecosystem:</span>
          {BRAND_IDS.map((id) => (
            <BrandLink key={id} id={id} active={active} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
      {BRAND_IDS.map((id) => (
        <BrandLink key={id} id={id} active={active} />
      ))}
    </div>
  );
}

function BrandLink({ id, active }: { id: BrandId; active: BrandId }) {
  const b = BRANDS[id];
  const isActive = id === active;
  // If this is the current domain, link to the dashboard; otherwise jump
  // to the sibling brand's apex hostname.
  const href = isActive ? "/" : `https://${b.domain}`;
  const className = isActive
    ? "font-semibold text-foreground"
    : "hover:text-foreground transition-colors";
  return (
    <a
      href={href}
      className={className}
      style={isActive ? { color: b.accentHex } : undefined}
      target={isActive ? "_self" : "_blank"}
      rel={isActive ? undefined : "noopener noreferrer"}
    >
      {b.displayName}
    </a>
  );
}
