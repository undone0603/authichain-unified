/**
 * Money CTAs for programmatic SEO hubs.
 *
 * Paths are the live checkout routes already served by Next
 * `src/app/api/checkout/dpp`, `src/app/api/checkout/plan/[planId]`,
 * and worker-app. Do not invent prices or Payment Links here.
 */

const DPP_CHECKOUT_HREF = "https://authichain.com/api/checkout/dpp";
const PASSPORT_CHECKOUT_HREF =
  "https://authichain.com/api/checkout/plan/strainchain_passport";
const PRICING_HREF = "/pricing";

function haystack(keyword) {
  return String(keyword || "").toLowerCase();
}

function brandKey(brand) {
  return String(brand || "").toLowerCase();
}

function hasWord(keyword, word) {
  return new RegExp(`\\b${word}\\b`, "i").test(String(keyword || ""));
}

/** AuthiChain DPP / battery / textile hubs → live DPP checkout. */
function isDppMoneyKeyword(keyword) {
  const k = haystack(keyword);
  if (k.includes("digital product passport")) return true;
  return ["dpp", "battery", "batteries", "textile", "textiles"].some((w) =>
    hasWord(keyword, w)
  );
}

/**
 * StrainChain cannabis / METRC / passport hubs → passport plan checkout.
 * Battery-passport language is DPP, not genetics, so those stay on the DPP path.
 */
function isStrainchainMoneyKeyword(keyword, brand) {
  if (isDppMoneyKeyword(keyword)) return false;
  if (brandKey(brand) === "strainchain") return true;
  return ["cannabis", "metrc", "passport"].some((w) => hasWord(keyword, w));
}

function moneyCtaLinks(keyword, brand) {
  if (isDppMoneyKeyword(keyword)) {
    return [
      { href: DPP_CHECKOUT_HREF, label: "Start DPP checkout" },
      { href: PRICING_HREF, label: "View pricing" },
    ];
  }
  if (isStrainchainMoneyKeyword(keyword, brand)) {
    return [
      { href: PASSPORT_CHECKOUT_HREF, label: "Publish one passport" },
      { href: PRICING_HREF, label: "View pricing" },
    ];
  }
  return [{ href: PRICING_HREF, label: "View pricing" }];
}

function moneyCtaHtml(keyword, brand) {
  const links = moneyCtaLinks(keyword, brand);
  const anchors = links
    .map((l) => `<a href="${l.href}">${l.label}</a>`)
    .join(" · ");
  return `<h2>Get started</h2><p>${anchors}</p>`;
}

module.exports = {
  DPP_CHECKOUT_HREF,
  PASSPORT_CHECKOUT_HREF,
  PRICING_HREF,
  isDppMoneyKeyword,
  isStrainchainMoneyKeyword,
  moneyCtaLinks,
  moneyCtaHtml,
};
