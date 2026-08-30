import { z } from "zod";

export const DsCsaMetadataSchema = z.object({
  lotNumber: z.string(),
  expirationDate: z.string().datetime(),
  tradingPartnerId: z.string(),
  transactionId: z.string(),
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
