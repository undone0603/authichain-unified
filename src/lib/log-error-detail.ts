export function logErrorDetail(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }
  const cause = (err as { cause?: unknown }).cause;
  const causeErr = cause instanceof Error ? cause : undefined;
  return {
    message: err.message,
    cause: causeErr?.message,
    causeCode: (causeErr as { code?: unknown } | undefined)?.code,
  };
}
