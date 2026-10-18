export const VERIFY_PRODUCT_DESCRIPTION =
  "Look up a product and scan the DigitalProductPassport stored on it. verified is true only when that scan is genuine.";

export const REGISTER_PRODUCT_DESCRIPTION =
  "Register a product. A supplied DigitalProductPassport is stored under its digital identity.";

export const TRUST_SCORE_DESCRIPTION =
  "Record caller-supplied check flags. When a product id is included, verified follows the DigitalProductPassport stored on that product.";

export const VERIFY_CANNABIS_DESCRIPTION =
  "Look up a strain name and scan the DigitalProductPassport stored on that product. verified is true only when that scan is genuine. Cannabinoid numbers are recorded only when the caller sends them.";

export const ANALYTICS_DESCRIPTION =
  "Return the metering stub. Counts stay at zero until usage metering is active. These counts are not a passport scan.";

export function trustScoreBody(input: {
  productId?: string;
  qrDecodePass?: boolean;
  blockchainCertExists?: boolean;
  nfcMatch?: boolean;
  visualMatch?: number;
  geoFenceOk?: boolean;
}) {
  return {
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.qrDecodePass !== undefined
      ? { qrDecodePass: input.qrDecodePass }
      : {}),
    ...(input.blockchainCertExists !== undefined
      ? { blockchainCertExists: input.blockchainCertExists }
      : {}),
    ...(input.nfcMatch !== undefined ? { nfcMatch: input.nfcMatch } : {}),
    ...(input.visualMatch !== undefined
      ? { visualMatch: input.visualMatch }
      : {}),
    ...(input.geoFenceOk !== undefined ? { geoFenceOk: input.geoFenceOk } : {}),
  };
}

export function registerProductBody(input: {
  name: string;
  manufacturer: string;
  serialNumber?: string;
  category?: string;
  metadata?: Record<string, string>;
  passport?: unknown;
  userId?: string;
}) {
  return {
    name: input.name,
    brand: input.manufacturer,
    manufacturer: input.manufacturer,
    category: input.category,
    serialNumber: input.serialNumber,
    metadata: input.metadata,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.passport !== undefined ? { passport: input.passport } : {}),
  };
}
