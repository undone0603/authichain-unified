import { z } from "zod";

export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string(), // Links to object_id in Identity Plane
  type: z.enum([
    "manufacturing",
    "inspection",
    "shipment",
    "commission",
    "pack",
    "receive",
    "dispense",
  ]),
  issuer: z.object({
    id: z.string(),
    name: z.string(),
  }),
  timestamp: z.string().datetime(),
  digest: z.string().startsWith("sha256:"),
  signature: z.string(), // Ed25519 signature of (payload + digest)
  metadata: z.record(z.any()).optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export function canonicalize(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(",")}}`;
}
