import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import * as db from "../db";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";
import { buildGoogleAuthUrl } from "./google-oauth";
import { resolveRole } from "./auth-roles";
import { sdk } from "./sdk";

const STATE_COOKIE = "oauth_state";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function originOf(req: Request): string {
  const proto =
    firstHeader(req.headers["x-forwarded-proto"])?.split(",")[0]?.trim() || req.protocol;
  const host = firstHeader(req.headers["x-forwarded-host"]) || req.get("host") || "";
  return `${proto}://${host}`;
}

function parseCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Initiate login: set CSRF nonce cookie, redirect to Google.
  app.get("/api/oauth/login", (req: Request, res: Response) => {
    if (!ENV.googleClientId) {
      res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });
      return;
    }
    const state = randomUUID();
    const redirectUri = `${originOf(req)}/api/oauth/callback`;
    const base = getSessionCookieOptions(req);
    res.cookie(STATE_COOKIE, state, { ...base, httpOnly: true, maxAge: 10 * 60 * 1000 });
    res.redirect(302, buildGoogleAuthUrl({ clientId: ENV.googleClientId, redirectUri, state }));
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const cookieState = parseCookie(req, STATE_COOKIE);

    if (!code || !state) {
      res.redirect(302, "/?authError=missing_params");
      return;
    }
    if (!cookieState || cookieState !== state) {
      res.redirect(302, "/?authError=bad_state");
      return;
    }

    const base = getSessionCookieOptions(req);
    res.clearCookie(STATE_COOKIE, base);

    try {
      const redirectUri = `${originOf(req)}/api/oauth/callback`;
      const tokenResponse = await sdk.exchangeCodeForToken(code, redirectUri);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.redirect(302, "/?authError=no_openid");
        return;
      }
      if ((userInfo as any).emailVerified === false) {
        res.redirect(302, "/?authError=email_unverified");
        return;
      }

      const email = userInfo.email ?? "";
      const role = resolveRole(email, ENV.ownerEmails);

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: email || null,
        loginMethod: userInfo.loginMethod ?? "google",
        role,
        lastSignedIn: new Date(),
      });

      // Claim any stripe-provisioned placeholder account (payment-link buyer
      // who purchased before signing in) — best-effort, never blocks login.
      try {
        await db.claimStripeProvisionedUser(userInfo.openId, email);
      } catch (claimError) {
        console.error("[OAuth] Failed to claim stripe-provisioned user", claimError);
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      res.cookie(COOKIE_NAME, sessionToken, { ...base, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.redirect(302, "/?authError=callback_failed");
    }
  });
}
