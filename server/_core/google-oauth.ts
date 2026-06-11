import axios from "axios";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function buildGoogleAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", opts.state);
  u.searchParams.set("access_type", "online");
  u.searchParams.set("prompt", "select_account");
  return u.toString();
}

export interface GoogleUserInfoRaw {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export interface MappedUserInfo {
  openId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  loginMethod: "google";
  platform: "google";
}

export function mapGoogleUserInfo(raw: GoogleUserInfoRaw): MappedUserInfo {
  return {
    openId: `google:${raw.sub}`,
    email: raw.email,
    emailVerified: raw.email_verified === true,
    name: raw.name ?? "",
    loginMethod: "google",
    platform: "google",
  };
}

/** Exchange an auth code for an access token at Google's token endpoint. */
export async function exchangeGoogleCode(opts: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; idToken?: string }> {
  const body = new URLSearchParams({
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    grant_type: "authorization_code",
  });
  const { data } = await axios.post(GOOGLE_TOKEN_URL, body.toString(), {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    timeout: 10000,
  });
  return { accessToken: data.access_token, idToken: data.id_token };
}

/** Fetch the Google userinfo for an access token. */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfoRaw> {
  const { data } = await axios.get<GoogleUserInfoRaw>(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
  });
  return data;
}
