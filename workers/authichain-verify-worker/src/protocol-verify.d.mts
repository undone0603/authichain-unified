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
