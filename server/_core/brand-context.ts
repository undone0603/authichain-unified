import { type TrpcContext } from "./context";
import { resolveBrand } from "../shared/brands";

/**
 * BrandContext provides brand-specific information extracted from the request.
 * This is used throughout the application to provide multi-tenant support.
 */
export type BrandContext = {
  brand: string;
};

/**
 * Extracts and returns the brand context from the base TRPC context.
 * It resolves the brand identifier based on the request's hostname.
 */
export function getBrandContext(ctx: TrpcContext): BrandContext {
  // Retrieves the brand based on the host header from the request object
  const host = ctx.req.headers.host || "";
  const brand = resolveBrand(host);
  
  return {
    brand,
  };
}
