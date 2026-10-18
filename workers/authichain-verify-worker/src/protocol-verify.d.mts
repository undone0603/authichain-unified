export function readStoredPassport(metadata: unknown): {
  record: Record<string, unknown>;
  anchor: Record<string, unknown> | null;
} | null;

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
  genuine?: boolean;
  digitalIdentity?: string | null;
} | null;

export function expectedRecordHash(record: unknown): string;

export const HASH_PUBLICATION_SENTENCE: string;

export const ANCHOR_UNREAD_SENTENCE: string;

export function passportHashPublished(input?: {
  genuine?: boolean;
  chain?: { queried?: boolean; onChain?: boolean; status?: string } | null;
}): boolean;

export function anchoredAfterChainRead(
  submitted: { genuine?: boolean; anchored?: boolean } | null | undefined,
  chain?: { queried?: boolean; onChain?: boolean; status?: string } | null,
): boolean;

export function publicationSentence(
  submitted: { genuine?: boolean } | null | undefined,
  chain?: { queried?: boolean; onChain?: boolean; status?: string } | null,
): string | null;

export function anchorUnreadSentence(
  submitted: { genuine?: boolean } | null | undefined,
  chain?: { queried?: boolean } | null,
): string | null;

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
