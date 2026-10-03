/**
 * Resolve a caller-supplied return path against our own origin.
 *
 * Only same-origin absolute paths ("/dashboard?x=1") are accepted. Full URLs,
 * protocol-relative ("//evil.example") and backslash tricks fall back to the
 * default, so a redirect parameter can never send a customer off-site.
 */
export function safeReturnUrl(
  baseUrl: string,
  requested: unknown,
  fallbackPath: string
): string {
  const base = new URL(baseUrl);
  const path =
    typeof requested === "string" &&
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.includes("\\")
      ? requested
      : fallbackPath;
  const resolved = new URL(path, base);
  return resolved.origin === base.origin
    ? resolved.toString()
    : new URL(fallbackPath, base).toString();
}
