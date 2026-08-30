import { z } from "zod";
import { EvidenceSchema as BaseEvidenceSchema } from "./base";

export * from "./base";
export { mapEpcisToDsCsa } from "./mapping";

export const DsCsaEvidenceSchema = BaseEvidenceSchema.extend({
  metadata: z.object({
    lotNumber: z.string(),
    expirationDate: z.string().datetime(),
    tradingPartnerId: z.string(),
    transactionId: z.string(),
  }),
});

export type DsCsaEvidence = z.infer<typeof DsCsaEvidenceSchema>;
export { DsCsaEvidenceSchema as DsCsaMetadataSchema };
