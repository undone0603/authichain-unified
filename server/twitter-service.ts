/**
 * Twitter / X API v2 Service
 *
 * Posts tweets on behalf of the @AuthiChain and @QRONspace accounts.
 * Uses OAuth 1.0a (4-token) for user-context write access.
 *
 * Required secrets (set via wrangler secret put or set-social-secrets.yml):
 *   TWITTER_API_KEY            — consumer key
 *   TWITTER_API_SECRET         — consumer secret
 *   TWITTER_ACCESS_TOKEN       — user access token
 *   TWITTER_ACCESS_TOKEN_SECRET— user access token secret
 *   TWITTER_QRON_API_KEY        — (optional) separate @QRONspace keys
 *   TWITTER_QRON_API_SECRET
 *   TWITTER_QRON_ACCESS_TOKEN
 *   TWITTER_QRON_ACCESS_TOKEN_SECRET
 */

import { createHmac, randomBytes } from "crypto";

const TWITTER_API_BASE = "https://api.twitter.com/2";

// ─── OAuth 1.0a signing ────────────────────────────────────────────────────

function pct(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildOAuthHeader(params: {
  method: string;
  url: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  bodyParams?: Record<string, string>;
}): string {
  const { method, url, apiKey, apiSecret, accessToken, accessTokenSecret, bodyParams = {} } = params;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     apiKey,
    oauth_nonce:            randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_token:            accessToken,
    oauth_version:          "1.0",
  };

  // Combine oauth + body params for signature base
  const allParams = { ...oauthParams, ...bodyParams };
  const sortedParams = Object.keys(allParams).sort()
    .map(k => `${pct(k)}=${pct(allParams[k]!)}`)
    .join("&");

  const sigBase = [method.toUpperCase(), pct(url), pct(sortedParams)].join("&");
  const sigKey = `${pct(apiSecret)}&${pct(accessTokenSecret)}`;
  // lgtm[js/weak-cryptographic-algorithm] Twitter OAuth 1.0a requires HMAC-SHA1
  const signature = createHmac("sha1", sigKey).update(sigBase).digest("base64");

  oauthParams["oauth_signature"] = signature;
  const authHeader = "OAuth " + Object.keys(oauthParams).sort()
    .map(k => `${pct(k)}="${pct(oauthParams[k]!)}"`)
    .join(", ");

  return authHeader;
}

// ─── Tweet posting ──────────────────────────────────────────────────────────

export interface TweetOptions {
  text: string;
  /** Optional image URL to download and attach as media (requires upload step) */
  imageUrl?: string;
  /** Use 'qron' to post from @QRONspace account instead of @AuthiChain */
  account?: "authichain" | "qron";
}

export interface TweetResult {
  id: string;
  text: string;
  url: string;
}

function getKeys(account: "authichain" | "qron" = "authichain") {
  const prefix = account === "qron" ? "TWITTER_QRON_" : "TWITTER_";
  const apiKey            = process.env[`${prefix}API_KEY`] ?? "";
  const apiSecret         = process.env[`${prefix}API_SECRET`] ?? "";
  const accessToken       = process.env[`${prefix}ACCESS_TOKEN`] ?? "";
  const accessTokenSecret = process.env[`${prefix}ACCESS_TOKEN_SECRET`] ?? "";
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error(`Twitter credentials not configured for account: ${account}. Set ${prefix}API_KEY, ${prefix}API_SECRET, ${prefix}ACCESS_TOKEN, ${prefix}ACCESS_TOKEN_SECRET.`);
  }
  return { apiKey, apiSecret, accessToken, accessTokenSecret };
}

export async function postTweet(opts: TweetOptions): Promise<TweetResult> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = getKeys(opts.account);
  const url = `${TWITTER_API_BASE}/tweets`;

  const body = JSON.stringify({ text: opts.text });
  const authHeader = buildOAuthHeader({
    method: "POST",
    url,
    apiKey, apiSecret, accessToken, accessTokenSecret,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twitter API error ${res.status}: ${err}`);
  }

  const json = await res.json() as { data: { id: string; text: string } };
  const id = json.data.id;
  // Determine account handle for the URL
  const handle = opts.account === "qron" ? "QRONspace" : "AuthiChain";
  return { id, text: json.data.text, url: `https://x.com/${handle}/status/${id}` };
}

/**
 * Post a thread of tweets (each tweet replies to the previous).
 */
export async function postThread(tweets: string[], account?: TweetOptions["account"]): Promise<TweetResult[]> {
  const results: TweetResult[] = [];
  let replyToId: string | undefined;

  for (const text of tweets) {
    const url = `${TWITTER_API_BASE}/tweets`;
    const { apiKey, apiSecret, accessToken, accessTokenSecret } = getKeys(account);
    const payload: Record<string, unknown> = { text };
    if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId };

    const authHeader = buildOAuthHeader({ method: "POST", url, apiKey, apiSecret, accessToken, accessTokenSecret });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Authorization": authHeader, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Thread tweet failed: ${await res.text()}`);
    const json = await res.json() as { data: { id: string; text: string } };
    const handle = account === "qron" ? "QRONspace" : "AuthiChain";
    results.push({ id: json.data.id, text: json.data.text, url: `https://x.com/${handle}/status/${json.data.id}` });
    replyToId = json.data.id;
  }

  return results;
}

/**
 * Fetch recent mentions for error monitoring / reply automation.
 */
export async function getRecentMentions(account?: TweetOptions["account"]): Promise<unknown[]> {
  const { apiKey, apiSecret, accessToken, accessTokenSecret } = getKeys(account);
  // Get authenticated user ID first
  const meUrl = `${TWITTER_API_BASE}/users/me`;
  const meAuth = buildOAuthHeader({ method: "GET", url: meUrl, apiKey, apiSecret, accessToken, accessTokenSecret });
  const meRes = await fetch(meUrl, { headers: { "Authorization": meAuth } });
  const meJson = await meRes.json() as { data: { id: string } };
  const userId = meJson.data.id;

  const mentionsUrl = `${TWITTER_API_BASE}/users/${userId}/mentions?max_results=20&tweet.fields=created_at,author_id,text`;
  const mentionsAuth = buildOAuthHeader({ method: "GET", url: mentionsUrl, apiKey, apiSecret, accessToken, accessTokenSecret });
  const mentionsRes = await fetch(mentionsUrl, { headers: { "Authorization": mentionsAuth } });
  const mentionsJson = await mentionsRes.json() as { data?: unknown[] };
  return mentionsJson.data ?? [];
}
