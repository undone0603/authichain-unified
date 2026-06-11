# Google OAuth Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unconfigured Manus/Forge OAuth with Google OAuth2 so humans can sign in to authichain.com (open signup → `user`; owner emails → `admin`), reusing the existing session-JWT and role machinery.

**Architecture:** Server-initiated Authorization-Code flow. A new `GET /api/oauth/login` sets a CSRF nonce cookie and redirects to Google; the existing `GET /api/oauth/callback` verifies the nonce, exchanges the code at Google's token endpoint, fetches userinfo, assigns role by email allowlist, upserts the user, and issues the existing JWT session cookie. The autonomous agents (internal secret) are untouched.

**Tech Stack:** Express, `axios` (already used in sdk.ts), `jose` (existing JWT), Vite/React client, Drizzle/Postgres, Vercel.

**Build/verify env:** Run all `pnpm`/`tsc` commands inside Ubuntu WSL with Node 22 (see `[[authichain-build-env]]`): `MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu bash -lc 'cd /home/zac/authichain-unified; export NVM_DIR=$HOME/.nvm; . $NVM_DIR/nvm.sh; nvm use 22 >/dev/null; export PATH="$(echo "$PATH"|tr ":" "\n"|grep -v /mnt/c/|paste -sd : -):$HOME/.nvm/versions/node/v22.22.3/bin"; <cmd>'`.

---

## File Structure

- `server/_core/env.ts` — MODIFY: add `googleClientId`, `googleClientSecret`, `ownerEmails`.
- `server/_core/auth-roles.ts` — CREATE: pure `resolveRole(email, ownerEmailsCsv)` helper.
- `server/_core/auth-roles.test.ts` — CREATE: tests for `resolveRole`.
- `server/_core/google-oauth.ts` — CREATE: pure helpers `buildGoogleAuthUrl(...)` and `mapGoogleUserInfo(raw)`; thin network fns `exchangeGoogleCode(...)`, `fetchGoogleUserInfo(...)`.
- `server/_core/google-oauth.test.ts` — CREATE: tests for `buildGoogleAuthUrl` + `mapGoogleUserInfo`.
- `server/_core/sdk.ts` — MODIFY: route `exchangeCodeForToken(code, redirectUri)` + `getUserInfo` through the Google fns; signature change (state→redirectUri).
- `server/_core/oauth.ts` — MODIFY: add `GET /api/oauth/login`; in callback verify state cookie, check `email_verified`, assign role, derive redirectUri.
- `client/src/const.ts` — MODIFY: `getLoginUrl` returns `"/api/oauth/login"`.
- `.env`, `.env.local` + Vercel prod env — config (Task 7).

`server/db.ts` `upsertUser` already persists `role` — no change needed (verified during design).

---

### Task 1: Add Google + owner env vars

**Files:**
- Modify: `server/_core/env.ts`

- [ ] **Step 1: Add the vars to the ENV object**

In `server/_core/env.ts`, inside the `ENV` object (e.g. after `samGovApiKey`), add:

```ts
  // ── Google OAuth ──────────────────────────────────────────────────────────
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  ownerEmails: process.env.OWNER_EMAILS ?? "",
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS (0 errors).

- [ ] **Step 3: Commit (only if the repo is using git for this work; otherwise skip)**

```bash
git add server/_core/env.ts && git commit -m "feat(auth): add google oauth + owner-email env vars"
```

---

### Task 2: Owner-email → role helper (TDD)

**Files:**
- Create: `server/_core/auth-roles.ts`
- Test: `server/_core/auth-roles.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// server/_core/auth-roles.test.ts
import { describe, it, expect } from "vitest";
import { resolveRole } from "./auth-roles";

describe("resolveRole", () => {
  const owners = "undone.k@gmail.com, authichain@gmail.com, Z@authichain.com";
  it("returns admin for an owner email (case-insensitive)", () => {
    expect(resolveRole("Z@AUTHICHAIN.COM", owners)).toBe("admin");
    expect(resolveRole("undone.k@gmail.com", owners)).toBe("admin");
  });
  it("returns user for a non-owner email", () => {
    expect(resolveRole("someone@example.com", owners)).toBe("user");
  });
  it("trims whitespace around entries", () => {
    expect(resolveRole("authichain@gmail.com", "  authichain@gmail.com  ")).toBe("admin");
  });
  it("returns user when allowlist is empty or email missing", () => {
    expect(resolveRole("a@b.com", "")).toBe("user");
    expect(resolveRole("", owners)).toBe("user");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_core/auth-roles.test.ts`
Expected: FAIL ("Cannot find module './auth-roles'" or `resolveRole` undefined).

- [ ] **Step 3: Implement**

```ts
// server/_core/auth-roles.ts
export type AppRole = "admin" | "user";

/** Returns "admin" if email is in the comma-separated owner allowlist (case-insensitive), else "user". */
export function resolveRole(email: string, ownerEmailsCsv: string): AppRole {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return "user";
  const owners = (ownerEmailsCsv ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(normalized) ? "admin" : "user";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_core/auth-roles.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit (skip if not using git here)**

```bash
git add server/_core/auth-roles.* && git commit -m "feat(auth): owner-email role resolver"
```

---

### Task 3: Google OAuth helpers (TDD for pure parts)

**Files:**
- Create: `server/_core/google-oauth.ts`
- Test: `server/_core/google-oauth.test.ts`

- [ ] **Step 1: Write the failing test (pure helpers only)**

```ts
// server/_core/google-oauth.test.ts
import { describe, it, expect } from "vitest";
import { buildGoogleAuthUrl, mapGoogleUserInfo } from "./google-oauth";

describe("buildGoogleAuthUrl", () => {
  it("builds an authorize URL with required params", () => {
    const url = new URL(buildGoogleAuthUrl({
      clientId: "cid", redirectUri: "https://authichain.com/api/oauth/callback", state: "nonce123",
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
      sub: "12345", email: "x@y.com", email_verified: true, name: "X Y", picture: "p",
    });
    expect(mapped).toEqual({
      openId: "google:12345", email: "x@y.com", emailVerified: true,
      name: "X Y", loginMethod: "google", platform: "google",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/_core/google-oauth.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// server/_core/google-oauth.ts
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
  sub: string; email: string; email_verified?: boolean; name?: string; picture?: string;
}
export interface MappedUserInfo {
  openId: string; email: string; emailVerified: boolean; name: string;
  loginMethod: "google"; platform: "google";
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
  code: string; redirectUri: string; clientId: string; clientSecret: string;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/_core/google-oauth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit (skip if not using git here)**

```bash
git add server/_core/google-oauth.* && git commit -m "feat(auth): google oauth url/token/userinfo helpers"
```

---

### Task 4: Route the SDK's exchange/userinfo through Google

**Files:**
- Modify: `server/_core/sdk.ts`

The existing `SDKServer.exchangeCodeForToken(code, state)` and `getUserInfo(accessToken)` delegate to the Manus `oauthService`. Repoint them at the Google helpers. Signature changes: `exchangeCodeForToken(code, redirectUri)`.

- [ ] **Step 1: Add the Google import**

At the top of `server/_core/sdk.ts`, add:

```ts
import { exchangeGoogleCode, fetchGoogleUserInfo, mapGoogleUserInfo } from "./google-oauth";
```

- [ ] **Step 2: Replace `exchangeCodeForToken` and `getUserInfo` bodies**

Replace the existing `exchangeCodeForToken(code, state)` method with:

```ts
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<ExchangeTokenResponse> {
    const { accessToken } = await exchangeGoogleCode({
      code,
      redirectUri,
      clientId: ENV.googleClientId,
      clientSecret: ENV.googleClientSecret,
    });
    return { accessToken } as ExchangeTokenResponse;
  }
```

Replace the existing `getUserInfo(accessToken)` method with:

```ts
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const raw = await fetchGoogleUserInfo(accessToken);
    return mapGoogleUserInfo(raw) as unknown as GetUserInfoResponse;
  }
```

(The Manus `OAuthService` class and its `getTokenByCode`/`getUserInfoByToken` are now unused; leave them or delete — `pnpm check` with `noUnusedLocals` off tolerates leaving them. Prefer deleting `OAuthService`, `createOAuthHttpClient`, the Manus path consts, and the now-unused `client`/`oauthService` fields if removal keeps `pnpm check` green.)

- [ ] **Step 3: Typecheck**

Run: `pnpm check`
Expected: PASS. If `MappedUserInfo`→`GetUserInfoResponse` cast errors, keep the `as unknown as` cast shown above.

- [ ] **Step 4: Commit (skip if not using git here)**

```bash
git add server/_core/sdk.ts && git commit -m "feat(auth): point session SDK at google token/userinfo"
```

---

### Task 5: Login route + CSRF state + role assignment in callback

**Files:**
- Modify: `server/_core/oauth.ts`

- [ ] **Step 1: Replace the file with the Google-aware version**

```ts
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

function originOf(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol;
  const host = req.headers["x-forwarded-host"] ?? req.get("host");
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

    if (!code || !state) { res.status(400).redirect("/?authError=missing_params"); return; }
    if (!cookieState || cookieState !== state) { res.status(400).redirect("/?authError=bad_state"); return; }

    const base = getSessionCookieOptions(req);
    res.clearCookie(STATE_COOKIE, base);

    try {
      const redirectUri = `${originOf(req)}/api/oauth/callback`;
      const tokenResponse = await sdk.exchangeCodeForToken(code, redirectUri);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) { res.status(400).redirect("/?authError=no_openid"); return; }
      if ((userInfo as any).emailVerified === false) { res.status(403).redirect("/?authError=email_unverified"); return; }

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

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      res.cookie(COOKIE_NAME, sessionToken, { ...base, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).redirect("/?authError=callback_failed");
    }
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS. (`upsertUser` accepts `role`; confirmed in db.ts.)

- [ ] **Step 3: Run the existing auth/session tests**

Run: `pnpm vitest run server/auth.logout.test.ts`
Expected: PASS (session/logout unaffected).

- [ ] **Step 4: Commit (skip if not using git here)**

```bash
git add server/_core/oauth.ts && git commit -m "feat(auth): google login route + csrf state + role assignment"
```

---

### Task 6: Point the client "Sign in" at the login route

**Files:**
- Modify: `client/src/const.ts`

- [ ] **Step 1: Simplify `getLoginUrl`**

Replace the entire `getLoginUrl` function body with:

```ts
export const getLoginUrl = () => "/api/oauth/login";
```

(Leaves the rest of `const.ts` unchanged.)

- [ ] **Step 2: Typecheck**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Commit (skip if not using git here)**

```bash
git add client/src/const.ts && git commit -m "feat(auth): client sign-in links to server login route"
```

---

### Task 7: Configure secrets + Google client, deploy, verify (ops)

**Owner action (one-time, Google Cloud Console):**
- [ ] Create OAuth 2.0 Client ID → Web application.
- [ ] Authorized redirect URIs: `https://authichain.com/api/oauth/callback` and the local dev callback (confirm dev origin via `pnpm dev`; add e.g. `http://localhost:5173/api/oauth/callback`).
- [ ] Authorized JS origins: `https://authichain.com` (+ local dev origin).
- [ ] Copy `client_id` and `client_secret`.

**Steps:**

- [ ] **Step 1: Generate a strong JWT secret**

Run (WSL): `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
Save the output for the next steps.

- [ ] **Step 2: Set local env** (append to `.env.local`, replacing the empty `JWT_SECRET=""`):

```
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>
JWT_SECRET=<generated-secret>
OWNER_EMAILS=undone.k@gmail.com,authichain@gmail.com,Z@authichain.com
```

- [ ] **Step 3: Set Vercel production env** (Windows CLI; values typed at the prompt):

```bash
printf '%s' "<client_id>"     | vercel env add GOOGLE_CLIENT_ID production
printf '%s' "<client_secret>" | vercel env add GOOGLE_CLIENT_SECRET production
printf '%s' "<generated>"     | vercel env add JWT_SECRET production
printf '%s' "undone.k@gmail.com,authichain@gmail.com,Z@authichain.com" | vercel env add OWNER_EMAILS production
```

- [ ] **Step 4: Full typecheck + build**

Run: `pnpm check && pnpm build`
Expected: both green.

- [ ] **Step 5: Local manual verification**

Run `pnpm dev`; click "Sign in" → Google consent → returns to `/` signed in. Confirm: an owner email gets `role=admin` (check `users` row), a non-owner gets `user`. Confirm a tampered/missing `oauth_state` cookie yields `/?authError=bad_state`.

- [ ] **Step 6: Deploy to production**

Run (Git Bash): `MSYS_NO_PATHCONV=1 vercel deploy "//wsl.localhost/Ubuntu/home/zac/authichain-unified" --prod --yes`
(Per `[[authichain-build-env]]`: plain upload, not `--archive=tgz`.)

- [ ] **Step 7: Production verification**

Open `https://authichain.com`, sign in with Google, confirm landing signed-in and correct role. Done.

---

## Notes / risks

- Redirect URI must match exactly between `/api/oauth/login` and `/api/oauth/callback` (both derive from request origin) and what's registered in Google. Behind Vercel, `x-forwarded-proto`/`x-forwarded-host` are honored by `originOf`.
- Preview-URL login intentionally unsupported (redirect URIs not registered).
- If `getSessionCookieOptions` sets `secure: true` on https, the `oauth_state` cookie is https-only — fine for prod and `https`-dev; for plain `http://localhost` it stays non-secure via the helper's request check.
