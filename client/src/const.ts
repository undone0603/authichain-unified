export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

<<<<<<< HEAD
// Sign-in is server-initiated: the server route sets the CSRF state cookie and
// redirects to Google (see server/_core/oauth.ts GET /api/oauth/login).
export const getLoginUrl = () => "/api/oauth/login";
=======
export function getBaseUrl() {
  const raw =
    import.meta.env.VITE_BASE_URL ||
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  if (!raw) throw new Error("Missing base URL");

  return raw.startsWith("http://") || raw.startsWith("https://")
    ? raw
    : `https://${raw}`;
}

export function makeUrl(path: string) {
  return new URL(path, getBaseUrl()).toString();
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(makeUrl('/app-auth'));
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
>>>>>>> origin/add-agentz-editable
