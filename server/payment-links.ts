/**
 * Stripe Payment Links — Authentic Economy
 *
 * All live payment links for QRON, AuthiChain, and StrainChain products.
 */

export const PAYMENT_LINKS = {
  qron: {
    singleDesign: {
      name: "QRON Single Design",
      price: "$49",
      url: "https://buy.stripe.com/aFafZh5Zf4t8dOG7nm1Nu1j",
    },
    brandPack: {
      name: "QRON Brand Pack (5x)",
      price: "$199",
      url: "https://buy.stripe.com/6oU5kDbjz0cSeSK4ba1Nu1k",
    },
    enterprise: {
      name: "QRON Enterprise",
      price: "$999/mo",
      url: "https://buy.stripe.com/8x2fZh73j8JofWO0YY1Nu1q",
    },
    credits50: {
      name: "50 Credits",
      price: "$9.99",
      url: "https://buy.stripe.com/3cIaEX73jcZE5ia2321Nu1l",
    },
    credits250: {
      name: "250 Credits",
      price: "$39.99",
      url: "https://buy.stripe.com/9B69AT73j9NseSKazy1Nu1m",
    },
    credits1000: {
      name: "1000 Credits",
      price: "$99.99",
      url: "https://buy.stripe.com/9B600j73jcZE6megXW1Nu1n",
    },
  },
  authichain: {
    starter: {
      name: "AuthiChain Starter",
      price: "$299/mo",
      url: "https://buy.stripe.com/28E8wP0EVf7M6mefTS1Nu1p",
    },
  },
  strainchain: {
    basic: {
      name: "StrainChain Basic",
      price: "$199/mo",
      url: "https://buy.stripe.com/9B6cN59br5xcaCuazy1Nu1o",
    },
  },
} as const;

export type PaymentLinkKey = keyof typeof PAYMENT_LINKS;
