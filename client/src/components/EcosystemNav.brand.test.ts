import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { EcosystemNav } from "./EcosystemNav";
import { BrandProvider } from "../contexts/BrandContext";

// Regression for the cutover blocker found in final review: the "/" homepage
// renders brand homes, each of which renders <EcosystemNav/>, which calls
// useBrand() and THROWS unless <BrandProvider> is mounted (App.tsx). Before the
// fix, every brand homepage rendered the ErrorBoundary fallback. SSR via
// react-dom/server reproduces the render-time throw in the node vitest env.
describe("EcosystemNav requires a mounted BrandProvider", () => {
  it("throws when rendered without a BrandProvider (the pre-fix crash)", () => {
    expect(() => renderToStaticMarkup(createElement(EcosystemNav))).toThrow(/BrandProvider/);
  });

  it("renders the ecosystem strip when wrapped in a BrandProvider (the fix)", () => {
    const html = renderToStaticMarkup(
      createElement(BrandProvider, null, createElement(EcosystemNav)),
    );
    expect(html).toContain("AuthiChain");
    expect(html).toContain("QRON");
  });
});
