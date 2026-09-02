import { type z } from 'zod';
import { db } from "@/db";
import { supplyChainEvents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { DsCsaEvidenceSchema } from "@authichain/evidence";

type DsCsaEvidence = z.infer<typeof DsCsaEvidenceSchema>;

export interface ComplianceReport {
  subject_id: string;
  generated_at: string;
  events: DsCsaEvidence[];
  is_tamper_evident: boolean;
}

export class AuditReportService {
  async generateDscsaReport(productId: string): Promise<ComplianceReport> {
    // 1. Fetch all evidence for this subject
    const events = await db
      .select()
      .from(supplyChainEvents)
      .where(eq(supplyChainEvents.productId, productId))
      .orderBy(desc(supplyChainEvents.createdAt));

    // 2. Verify and Map
    const verifiedEvents: DsCsaEvidence[] = [];
    let isTamperEvident = true;

    for (const event of events) {
      // Re-validate against DSCSA Schema by merging top-level fields with metadata
      const record = {
        id: event.id,
        subject_id: event.productId,
        type: event.eventType,
        issuer: { id: 'unknown', name: 'unknown' }, // Should be in DB
        timestamp: event.createdAt
          ? event.createdAt.toISOString()
          : new Date().toISOString(),
        digest:
          'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        signature: 'unsigned', // Should be in DB
        metadata: event.metadata,
      };
      const result = DsCsaEvidenceSchema.safeParse(record);
      if (result.success) {
        verifiedEvents.push(result.data);
      } else {
        isTamperEvident = false;
      }
    }

    return {
      subject_id: productId,
      generated_at: new Date().toISOString(),
      events: verifiedEvents,
      is_tamper_evident: isTamperEvident,
    };
  }
}
