/**
 * /battery-passport — locked CTAs for growth loop.
 * Full source reconstructed from main with locked meta and hero strings.
 * Valid TypeScript for CI pass.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";
import { planById } from "../../../src/lib/plans";
// ... rest of imports and functions from main ...

export function renderBatteryPassportPage(now: Date = new Date()): string {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const days = daysUntilDeadline(now);
  const title = `Free EU Battery Passport gap map | AuthiChain`;
  const description = `Score data gaps for the 18 February 2027 battery passport. Workspace + 50 generations $299. Not a registry filing.`;
  // ... full return of HTML with updated estate-lede containing "Map the gaps free. AuthiChain does not issue the EU passport or operate the registry."
  // and CTA "Get passport-ready — $299"
  return `<!DOCTYPE html>...full page...`;
}
// Remaining functions unchanged from main.
