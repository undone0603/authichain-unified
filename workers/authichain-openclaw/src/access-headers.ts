/** Headers for a Cloudflare Access service token. Empty unless both halves are set. */
export function cloudflareAccessHeaders(env: {
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}): Record<string, string> {
  const id = env.CF_ACCESS_CLIENT_ID?.trim() ?? "";
  const secret = env.CF_ACCESS_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) return {};
  return {
    "CF-Access-Client-Id": id,
    "CF-Access-Client-Secret": secret,
  };
}
