import schema from "../../../schemas/authichain-attestation-v0.1.schema.json";

/** Public id declared by schemas/authichain-attestation-v0.1.schema.json. */
export const ATTESTATION_SCHEMA_PATH = "/schemas/attestation-v0.1.json";

/**
 * Serves Attestation Contract v0.1 at its schema $id.
 * Any other path returns null so the caller can keep unknown URLs on 404.
 */
export function attestationSchemaResponse(pathname: string): Response | null {
  if (pathname !== ATTESTATION_SCHEMA_PATH) return null;
  return new Response(JSON.stringify(schema), {
    headers: {
      "content-type": "application/schema+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
