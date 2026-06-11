# Design Spec — Google OAuth Login (Approach A: swap provider in place)

**Date:** 2026-06-10
**Status:** Approved (pending written-spec review)
**Scope:** Replace the unconfigured Manus/Forge OAuth with Google OAuth2 for human sign-in to authichain.com, reusing the existing session/role machinery.

## Goal & context

`authichain-unified` is a solo operation: one human owner + in-app autonomous agents. The autonomous agents authenticate server-side via `INTERNAL_API_SECRET` and do **not** use user login — out of scope here. OAuth login exists only to get **humans** into the operator console.

The existing OAuth implementation (`server/_core/oauth.ts` callback, `server/_core/sdk.ts` SDK) is complete but bound to the Manus/Forge platform the app was scaffolded on, and is unconfigured for the standalone deployment (`OAUTH_SERVER_URL`, app id, and `JWT_SECRET` are all empty). We swap the provider to Google while keeping the callback route, session-cookie/JWT signing, role system, and tRPC auth context intact.

## Decisions

- **Provider:** Google OAuth2 (Authorization Code flow), client owned by us in Google Cloud Console.
- **Access model:** Open signup — anyone with a Google account can sign in and gets `role: "user"` (enables future customer self-serve).
- **Admin:** Email allowlist `OWNER_EMAILS` → `role: "admin"`. List: `undone.k@gmail.com`, `authichain@gmail.com`, `Z@authichain.com` (matched case-insensitively).
- **Server-initiated flow:** A new `GET /api/oauth/login` route builds the Google authorize URL and sets the CSRF nonce cookie server-side. The client "Sign in" link simply points to this path — so **no Google client ID is exposed to / needed by the client build** (`VITE_GOOGLE_CLIENT_ID` is NOT required).
- **Preview URLs:** Out of scope. Register only production (`https://authichain.com/api/oauth/callback`) and local dev. Login will not work on ephemeral Vercel preview URLs.
- **CSRF:** Random nonce stored in a short-lived httpOnly cookie (`oauth_state`), set by the server at `/api/oauth/login`, verified at `/api/oauth/callback`.
- **Session:** Unchanged — local JWT signed with `JWT_SECRET` (must be set to a strong value), set as the existing session cookie.

## Architecture / flow

1. **Client** (`client/src/const.ts` `getLoginUrl`): returns the relative path `"/api/oauth/login"`. The "Sign in" / "Launch Console" controls navigate there. (No URL/secret construction on the client.)
2. **Login initiation** (server, new route `GET /api/oauth/login` in `server/_core/oauth.ts`): generate a random `state` nonce; set it in a short-lived httpOnly `oauth_state` cookie; build the Google authorize URL —
   `https://accounts.google.com/o/oauth2/v2/auth?client_id=<GOOGLE_CLIENT_ID>&redirect_uri=<origin>/api/oauth/callback&response_type=code&scope=openid%20email%20profile&state=<nonce>&access_type=online&prompt=select_account` —
   and `302` redirect to it. `<origin>` is derived from the request (host/proto), so prod and localhost both work without hardcoding.
3. **Google** authenticates the user and redirects to the existing `GET /api/oauth/callback?code&state`.
4. **Callback** (`server/_core/oauth.ts`): verify `state` equals the `oauth_state` cookie (reject 400 + redirect `/?authError=1` on mismatch/absence); clear the cookie.
5. **Token exchange** (`server/_core/sdk.ts` `exchangeCodeForToken`): POST `https://oauth2.googleapis.com/token` with `client_id`, `client_secret`, `code`, `redirect_uri`, `grant_type=authorization_code`. Returns `access_token` + `id_token`.
6. **User info** (`sdk.getUserInfo`): GET `https://www.googleapis.com/oauth2/v3/userinfo` with the access token. Yields `sub`, `email`, `email_verified`, `name`, `picture`. Reject if `email_verified` is false.
7. **Map & role:** `openId = "google:" + sub`; `loginMethod = "google"`; `role = OWNER_EMAILS.split(",").map(trim+lowercase).includes(email.toLowerCase()) ? "admin" : "user"`.
8. **Persist & session:** existing `db.upsertUser({ openId, name, email, loginMethod, role, lastSignedIn })` → `sdk.createSessionToken(openId, {...})` (JWT/`JWT_SECRET`) → set session cookie → `res.redirect(302, "/")`.

## Components / files changed

- `server/_core/oauth.ts` — add `GET /api/oauth/login` (nonce cookie + Google authorize redirect); in the callback add `state` CSRF verification, `email_verified` check, and email→role assignment before `upsertUser`.
- `server/_core/sdk.ts` — reimplement `exchangeCodeForToken` + `getUserInfo` against Google endpoints; keep `createSessionToken`/`signSession` unchanged; remove reliance on the Manus `oauthService`.
- `client/src/const.ts` — `getLoginUrl` returns `"/api/oauth/login"`.
- `server/db.ts` — ensure `upsertUser` persists `role` on both insert and update.
- `server/_core/env.ts` — add `googleClientId`, `googleClientSecret`, `ownerEmails` (server-side only).
- Env files (`.env`, `.env.local`) + Vercel **production** env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `OWNER_EMAILS`. (No `VITE_` var needed.)

## Owner-performed setup (Google Cloud Console)

Create an OAuth 2.0 Client ID (Web application). Authorized redirect URIs: `https://authichain.com/api/oauth/callback` and the local dev callback (`http://localhost:5173/api/oauth/callback` if the client dev origin is Vite's default; confirm the actual dev origin during implementation). Authorized JS origins: `https://authichain.com` (+ local dev origin). Consent screen: External; scopes `openid`, `email`, `profile`. Yields `client_id` + `client_secret`.

## Error handling

- Missing `code`, or `state` mismatch/absent → 400 then redirect `/?authError=1` (no stack leak).
- Token exchange / userinfo failure → 500 logged server-side, generic client message.
- `email_verified === false` → reject with a clear message.
- Missing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`JWT_SECRET` at runtime → fail fast with a clear server log; never issue an unsigned session.

## Testing / verification

- Unit: role assignment (owner email → admin; other → user; case-insensitive, whitespace-tolerant); state verification (match / mismatch / missing).
- Local: `pnpm dev`, Sign in → Google → callback → session cookie set, correct role, lands on `/`.
- Prod: after Vercel env set + deploy, verify sign-in on `https://authichain.com`; an owner email lands as admin, a non-owner as user.
- Regression: existing session/JWT tests (`auth.logout.test.ts`, etc.) still pass; `pnpm check` stays green.

## Out of scope

- Autonomous agents/crons (continue using `INTERNAL_API_SECRET`).
- Multi-tenant / per-brand auth, additional providers, account linking.
- Preview-URL login.
- Logout flow changes (existing logout remains).
