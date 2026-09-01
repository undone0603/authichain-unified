import { z } from "zod";

export const DsCsaMetadataSchema = z.object({
  lotNumber: z.string(),
  expirationDate: z.string().datetime(),
  tradingPartnerId: z.string(),
  transactionId: z.string(),
});

export const DsCsaEvidenceSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string(),
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
  signature: z.string(),
  metadata: DsCsaMetadataSchema,
});

export type DsCsaEvidence = {
  // Need to define the full type here if I don't extend
  id: string;
  subject_id: string;
  type:
    | "manufacturing"
    | "inspection"
    | "shipment"
    | "commission"
    | "pack"
    | "receive"
    | "dispense";
  issuer: { id: string; name: string };
  timestamp: string;
  digest: string;
  signature: string;
  metadata: z.infer<typeof DsCsaMetadataSchema>;
};
