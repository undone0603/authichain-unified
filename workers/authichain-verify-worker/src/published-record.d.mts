export function publishedRecord(raw: string | null | undefined): {
  record: Record<string, unknown>;
  anchor: Record<string, unknown>;
  source: "published_example";
} | null;
