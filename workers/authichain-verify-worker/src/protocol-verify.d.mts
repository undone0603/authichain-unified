export function verifySubmitted(
  record: unknown,
  anchor?: unknown,
): {
  verdict: "verified" | "valid-unanchored" | "invalid";
  reasons: string[];
  checks: Record<string, unknown>;
  decision: "verified" | "valid-unanchored" | "invalid";
  anchored: boolean;
  anchorTransactionQueried: false;
} | null;

export function expectedRecordHash(record: unknown): string;

export function readAnchorOnChain(
  record: unknown,
  anchor: unknown,
  opts?: { rpcUrl?: string; fetchImpl?: typeof fetch },
): Promise<{
  queried: boolean;
  onChain: boolean;
  status: string;
  block?: string | null;
  txFrom?: string | null;
  txTo?: string | null;
}>;
