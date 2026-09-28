// Shared LM Studio auth for local clients.
// Sends Authorization: Bearer only to loopback or RFC1918 hosts.
// Never logs the token. No default placeholder key.

const TOKEN_KEYS = [
  "LM_STUDIO_API_TOKEN",
  "LM_API_TOKEN",
  "LM_STUDIO_API_KEY",
  "LOCAL_LLM_API_KEY",
];

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|::1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/i;

export function localLlmToken(env = process.env) {
  for (const key of TOKEN_KEYS) {
    const value = String(env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export function isPrivateLlmUrl(raw) {
  try {
    const u = new URL(String(raw ?? "").includes("://") ? raw : `http://${raw}`);
    return PRIVATE_HOST.test(u.hostname || "");
  } catch {
    return false;
  }
}

export function localLlmHeaders(url, env = process.env) {
  const headers = { "Content-Type": "application/json" };
  const token = localLlmToken(env);
  if (token && isPrivateLlmUrl(url)) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
