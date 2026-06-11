import { describe, it, expect } from "vitest";
import { buildGoogleAuthUrl, mapGoogleUserInfo } from "./google-oauth";

describe("buildGoogleAuthUrl", () => {
  it("builds an authorize URL with required params", () => {
    const url = new URL(buildGoogleAuthUrl({
      clientId: "cid",
      redirectUri: "https://authichain.com/api/oauth/callback",
      state: "nonce123",
    }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://authichain.com/api/oauth/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("nonce123");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("mapGoogleUserInfo", () => {
  it("maps Google userinfo to the app shape", () => {
    const mapped = mapGoogleUserInfo({
      sub: "12345",
      email: "x@y.com",
      email_verified: true,
      name: "X Y",
      picture: "p",
    });
    expect(mapped).toEqual({
      openId: "google:12345",
      email: "x@y.com",
      emailVerified: true,
      name: "X Y",
      loginMethod: "google",
      platform: "google",
    });
  });
});
