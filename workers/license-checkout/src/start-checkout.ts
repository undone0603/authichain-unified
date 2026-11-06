/** Client helper for the AuthiChain/StrainChain pricing component. */
export async function startCheckout(
  sku: "OEM-VERIFY" | "PACK-WORKFLOW",
  checkoutOrigin: string,
  request: typeof fetch = globalThis.fetch,
  navigate: (url: string) => void = url => window.location.assign(url),
): Promise<void> {
  const origin = new URL(checkoutOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Invalid checkout origin");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const claim = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const response = await request(`${origin.origin}/checkout`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku, claim }),
  });
  const data = await response.json() as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout is unavailable");
  const hosted = new URL(data.url);
  if (hosted.origin !== "https://checkout.stripe.com") throw new Error("Invalid payment destination");
  navigate(hosted.href);
}
