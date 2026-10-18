export const VERIFY_PRODUCT_DESCRIPTION =
  "Look up a product and scan the DigitalProductPassport stored on it. verified is true only when that scan is genuine.";

export const REGISTER_PRODUCT_DESCRIPTION =
  "Register a product. A supplied DigitalProductPassport is stored under its digital identity.";

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
