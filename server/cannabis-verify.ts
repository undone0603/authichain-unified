/** Numbers the caller sent. An omitted percent stays null. */
export function cannabisCallerNumbers(body: {
  thcPercent?: unknown;
  cbdPercent?: unknown;
  batchId?: unknown;
  dispensaryId?: unknown;
}): {
  thcPercent: number | null;
  cbdPercent: number | null;
  batchId: string | null;
  dispensaryId: string | null;
} {
  const percent = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    thcPercent: percent(body.thcPercent),
    cbdPercent: percent(body.cbdPercent),
    batchId: text(body.batchId),
    dispensaryId: text(body.dispensaryId),
  };
}
