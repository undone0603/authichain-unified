export type PassportResult =
  | "issued"
  | "active"
  | "clone_suspected"
  | "cloned"
  | "revoked"
  | "not_found";

export type PassportPayload = {
  success: boolean;
  result: PassportResult;
  label: string;
  proves: string;
  does_not_prove: string;
  digital_link: string;
  product: {
    cert_id: string;
    name: string | null;
    brand: string | null;
    gtin: string | null;
    lot: string | null;
    serial: string | null;
    expiry: string | null;
    issuer: string | null;
    issued_at: string;
    fingerprint_sha256: string | null;
  } | null;
  chain: {
    network: string | null;
    contract: string | null;
    tx: string | null;
    explorer: string | null;
  } | null;
  scans: {
    count: number;
    last_at: string | null;
    first_country: string | null;
  } | null;
  status_reason: string | null;
};

export function resolverBase() {
  return (
    process.env.NEXT_PUBLIC_RESOLVER_ORIGIN ||
    process.env.RESOLVER_ORIGIN ||
    "https://id.authichain.com"
  ).replace(/\/+$/, "");
}

export async function fetchPassport(id: string): Promise<PassportPayload | null> {
  const url = `${resolverBase()}/v1/passport/${encodeURIComponent(id)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    const data = (await res.json()) as PassportPayload;
    return data;
  } catch {
    return null;
  }
}
