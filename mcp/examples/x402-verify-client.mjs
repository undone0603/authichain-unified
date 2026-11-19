import { pathToFileURL } from "node:url";

export const DEFAULT_X402_ENDPOINT = "https://authichain.com/api/x402";
export const EXPECTED_TREASURY_PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
export const BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const ALLOWED_BASE_NETWORKS = new Set(["base", "eip155:8453"]);
export const DEFAULT_MAX_USDC_ATOMIC = 100000n;

function normalizeAddress(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function extractChallenge(response, body) {
  if (body && Array.isArray(body.accepts) && body.accepts.length > 0) {
    return body;
  }
  const header = response?.headers?.get?.("payment-required") ?? response?.headers?.get?.("PAYMENT-REQUIRED");
  if (!header) {
    return body;
  }
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return body;
  }
}

export function validateX402Challenge(challenge, options = {}) {
  const expectedPayTo = options.expectedPayTo ?? EXPECTED_TREASURY_PAY_TO;
  const expectedAsset = options.expectedAsset ?? BASE_USDC_ASSET;
  const maxAmountAtomic = BigInt(options.maxAmountAtomic ?? DEFAULT_MAX_USDC_ATOMIC);

  const accepts = Array.isArray(challenge?.accepts) ? challenge.accepts : [];
  if (accepts.length === 0) {
    return {
      ok: false,
      code: "missing_accepts",
      reason: "402 challenge did not include any payment requirements in accepts[]",
    };
  }

  const requirement = accepts[0];
  const network = typeof requirement?.network === "string" ? requirement.network.trim().toLowerCase() : "";
  if (!ALLOWED_BASE_NETWORKS.has(network)) {
    return {
      ok: false,
      code: "unsupported_network",
      reason: `Refusing non-Base network: ${requirement?.network ?? "unknown"}`,
    };
  }

  if (normalizeAddress(requirement?.asset) !== normalizeAddress(expectedAsset)) {
    return {
      ok: false,
      code: "unsupported_asset",
      reason: `Refusing non-Base-USDC asset: ${requirement?.asset ?? "unknown"}`,
    };
  }

  if (normalizeAddress(requirement?.payTo) !== normalizeAddress(expectedPayTo)) {
    return {
      ok: false,
      code: "wrong_recipient",
      reason: `Refusing payTo ${requirement?.payTo ?? "missing"}; expected ${expectedPayTo}`,
    };
  }
  if (
      requirement?.amount !== undefined && requirement?.amount !== null &&
    requirement?.maxAmountRequired !== undefined && requirement?.maxAmountRequired !== null &&
    String(requirement.amount) !== String(requirement.maxAmountRequired)
    ) {
    return { ok: false, code: "conflicting_amount_fields", reason: "conflicting_amount_fields" };
  }
  const rawAmount = requirement?.amount ?? requirement?.maxAmountRequired;
  if (typeof rawAmount !== "string" && typeof rawAmount !== "number") {
    return {
      ok: false,
      code: "invalid_amount",
      reason: "402 challenge is missing maxAmountRequired/amount",
    };
  }

  let amountAtomic;
  try {
    amountAtomic = BigInt(String(rawAmount));
  } catch {
    return {
      ok: false,
      code: "invalid_amount",
      reason: `Invalid atomic amount: ${rawAmount}`,
    };
  }

  if (amountAtomic <= 0n) {
    return {
      ok: false,
      code: "invalid_amount",
      reason: `Amount must be positive, received ${amountAtomic.toString()}`,
    };
  }

  if (amountAtomic > maxAmountAtomic) {
    return {
      ok: false,
      code: "over_budget",
      reason: `Refusing amount ${amountAtomic.toString()} > maxAmountAtomic ${maxAmountAtomic.toString()}`,
    };
  }

  return {
    ok: true,
    requirement,
    amountAtomic,
  };
}

export async function runX402VerifyClient({
  endpoint = process.env.AUTHICHAIN_X402_URL || DEFAULT_X402_ENDPOINT,
  payload = { sku: "DEMO-001" },
  maxAmountAtomic = process.env.AUTHICHAIN_X402_MAX_USDC_ATOMIC || DEFAULT_MAX_USDC_ATOMIC,
  expectedPayTo = EXPECTED_TREASURY_PAY_TO,
  expectedAsset = BASE_USDC_ASSET,
  paymentSignature,
  createPaymentSignature,
  fetchImpl = fetch,
} = {}) {
  const initialRes = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const initialBody = await readJsonSafe(initialRes);

  if (initialRes.status === 503 && (initialBody?.error === "registry_not_bound" || initialBody?.code === "registry_not_bound")) {
    return {
      ok: false,
      status: 503,
      refused: true,
      code: "registry_not_bound",
      reason: "Endpoint returned 503 registry_not_bound; refusing before any settlement",
      body: initialBody,
    };
  }

  if (initialRes.status === 200) {
    return {
      ok: true,
      status: 200,
      paid: false,
      body: initialBody,
    };
  }

  if (initialRes.status !== 402) {
    return {
      ok: false,
      status: initialRes.status,
      refused: true,
      code: "unexpected_status",
      reason: `Expected 402 or 200, received ${initialRes.status}`,
      body: initialBody,
    };
  }

  const challenge = extractChallenge(initialRes, initialBody);
  const validation = validateX402Challenge(challenge, {
    expectedPayTo,
    expectedAsset,
    maxAmountAtomic,
  });

  if (!validation.ok) {
    return {
      ok: false,
      status: 402,
      refused: true,
      code: validation.code,
      reason: validation.reason,
      challenge,
    };
  }

  const hasSigner = typeof createPaymentSignature === "function" || (typeof paymentSignature === "string" && paymentSignature.length > 0);
  if (!hasSigner) {
    return {
      ok: true,
      status: 402,
      noSpend: true,
      validated: true,
      requirement: validation.requirement,
      amountAtomic: validation.amountAtomic.toString(),
      challenge,
    };
  }

  const signature = typeof createPaymentSignature === "function"
    ? await createPaymentSignature(validation.requirement)
    : paymentSignature;

  const paidRes = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-SIGNATURE": signature,
    },
    body: JSON.stringify(payload),
  });

  const paidBody = await readJsonSafe(paidRes);

  if (paidRes.status === 503 && (paidBody?.error === "registry_not_bound" || paidBody?.code === "registry_not_bound")) {
    return {
      ok: false,
      status: 503,
      refused: true,
      code: "registry_not_bound",
      reason: "Endpoint returned 503 registry_not_bound on paid retry",
      body: paidBody,
    };
  }

  if (paidRes.status !== 200) {
    return {
      ok: false,
      status: paidRes.status,
      refused: true,
      code: "payment_rejected",
      reason: `Paid request failed with status ${paidRes.status}`,
      body: paidBody,
    };
  }

  return {
    ok: true,
    status: 200,
    paid: true,
    requirement: validation.requirement,
    amountAtomic: validation.amountAtomic.toString(),
    body: paidBody,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runX402VerifyClient({
    paymentSignature: process.env.AUTHICHAIN_X402_PAYMENT_SIGNATURE,
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
}
