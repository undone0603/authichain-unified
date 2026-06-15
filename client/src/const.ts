export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Sign-in is server-initiated: the server route sets the CSRF state cookie and
// redirects to Google (see server/_core/oauth.ts GET /api/oauth/login).
export const getLoginUrl = () => "/api/oauth/login";
