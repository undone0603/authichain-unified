/**
 * LinkedIn API v2 Service
 *
 * Posts content to LinkedIn on behalf of the authenticated user (undone.k@gmail.com)
 * and an optional company page.
 *
 * Required secrets:
 *   LINKEDIN_CLIENT_ID       — OAuth 2.0 client ID
 *   LINKEDIN_CLIENT_SECRET   — OAuth 2.0 client secret
 *   LINKEDIN_ACCESS_TOKEN    — Long-lived access token (run linkedin-oauth-setup.mjs)
 *   LINKEDIN_PERSON_URN      — e.g. "urn:li:person:XXXXXXXX" (printed by setup script)
 *   LINKEDIN_ORG_URN         — Optional: "urn:li:organization:XXXXXXXX" for company page posts
 */

const LI_API    = "https://api.linkedin.com/v2";
const LI_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

// ─── Token management ──────────────────────────────────────────────────────
// LinkedIn access tokens last 60 days; we refresh via the refresh token flow.
// Short-circuit if still valid (we cache in-process only; each Worker invocation
// starts fresh, so we simply hit the token endpoint on first use per request).

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 60_000) {
    return _tokenCache.token;
  }

  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN ?? "";
  const clientId     = process.env.LINKEDIN_CLIENT_ID ?? "";
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? "";

  // If we have a long-lived access token and no refresh token, use it directly
  const directToken = process.env.LINKEDIN_ACCESS_TOKEN ?? "";
  if (!refreshToken && directToken) {
    // Assume it's valid; LinkedIn tokens are 60 days, so we rely on periodic renewal
    _tokenCache = { token: directToken, expiresAt: Date.now() + 55 * 24 * 60 * 60 * 1000 };
    return directToken;
  }

  if (!refreshToken) throw new Error("LINKEDIN_REFRESH_TOKEN or LINKEDIN_ACCESS_TOKEN not set");
  if (!clientId || !clientSecret) throw new Error("LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not set");

  const res = await fetch(LI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${await res.text()}`);

  const json = await res.json() as { access_token: string; expires_in: number };
  _tokenCache = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LinkedInPostParams {
  text: string;
  /** "person" posts as the authenticated user; "org" posts as the company page */
  author?: "person" | "org";
  /** Optional URL to share as a link attachment */
  url?: string;
  /** Optional title for the link attachment */
  urlTitle?: string;
  /** Optional description for the link attachment */
  urlDescription?: string;
}

export interface LinkedInPost {
  id: string;
  postUrl: string;
}

// ─── Post to LinkedIn ──────────────────────────────────────────────────────

/**
 * Creates a UGC post on LinkedIn (text or text + link).
 * Returns the post ID and a best-effort post URL.
 */
export async function postUpdate(params: LinkedInPostParams): Promise<LinkedInPost> {
  const token = await getAccessToken();

  const personUrn = process.env.LINKEDIN_PERSON_URN ?? "";
  const orgUrn    = process.env.LINKEDIN_ORG_URN ?? "";

  const author = params.author === "org" && orgUrn ? orgUrn : personUrn;
  if (!author) throw new Error("LINKEDIN_PERSON_URN not set");

  // Build UGC post body
  const body: Record<string, unknown> = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: params.text },
        shareMediaCategory: params.url ? "ARTICLE" : "NONE",
        ...(params.url
          ? {
              media: [
                {
                  status:      "READY",
                  originalUrl: params.url,
                  title:       { text: params.urlTitle ?? params.url },
                  description: { text: params.urlDescription ?? "" },
                },
              ],
            }
          : {}),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch(`${LI_API}/ugcPosts`, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`LinkedIn post failed (${res.status}): ${await res.text()}`);

  const postId = res.headers.get("x-restli-id") ?? "";

  return {
    id:      postId,
    postUrl: `https://www.linkedin.com/feed/update/${postId}`,
  };
}

// ─── Post thread (multi-post sequence) ────────────────────────────────────

/**
 * Posts multiple updates to LinkedIn. LinkedIn has no native thread concept,
 * so this posts them sequentially with 1-second spacing.
 */
export async function postLinkedInThread(texts: string[], author: "person" | "org" = "person"): Promise<LinkedInPost[]> {
  const results: LinkedInPost[] = [];
  for (const text of texts) {
    const result = await postUpdate({ text, author });
    results.push(result);
    // Small delay to avoid rate-limit burst
    await new Promise(r => setTimeout(r, 1000));
  }
  return results;
}

// ─── Get authenticated user profile ────────────────────────────────────────

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  urn: string;
}

export async function getProfile(): Promise<LinkedInProfile | null> {
  const token = await getAccessToken();
  const res = await fetch(`${LI_API}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  if (!res.ok) return null;
  const json = await res.json() as any;
  return {
    id:        json.id ?? "",
    firstName: json.localizedFirstName ?? "",
    lastName:  json.localizedLastName ?? "",
    urn:       `urn:li:person:${json.id}`,
  };
}
