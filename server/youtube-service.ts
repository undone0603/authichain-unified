/**
 * YouTube Data API v3 Service
 *
 * Uploads HeyGen-generated videos to the AuthiChain / QRON YouTube channels.
 * Reads channel/playlist data for embedding on qron.space.
 *
 * Required secrets:
 *   YOUTUBE_CLIENT_ID          — OAuth 2.0 client ID
 *   YOUTUBE_CLIENT_SECRET      — OAuth 2.0 client secret
 *   YOUTUBE_REFRESH_TOKEN      — Long-lived refresh token (run youtube-oauth-setup.mjs)
 *   YOUTUBE_CHANNEL_ID         — AuthiChain channel ID (UCxxxxxxxx)
 *   YOUTUBE_QRON_REFRESH_TOKEN — Separate refresh token for QRON channel (optional)
 *   YOUTUBE_QRON_CHANNEL_ID    — QRON channel ID
 */

const YT_TOKEN_URL  = "https://oauth2.googleapis.com/token";
const YT_API_BASE   = "https://www.googleapis.com/youtube/v3";
const YT_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";

// ─── OAuth token refresh ───────────────────────────────────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null;
let _qronTokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(channel: "authichain" | "qron" = "authichain"): Promise<string> {
  const cache = channel === "qron" ? _qronTokenCache : _tokenCache;
  if (cache && cache.expiresAt > Date.now() + 30_000) return cache.token;

  const refreshToken = channel === "qron"
    ? (process.env.YOUTUBE_QRON_REFRESH_TOKEN ?? "")
    : (process.env.YOUTUBE_REFRESH_TOKEN ?? "");
  if (!refreshToken) throw new Error(`YOUTUBE_${channel === "qron" ? "QRON_" : ""}REFRESH_TOKEN not set`);

  const res = await fetch(YT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.YOUTUBE_CLIENT_ID ?? "",
      client_secret: process.env.YOUTUBE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`YouTube token refresh failed: ${await res.text()}`);
  const json = await res.json() as { access_token: string; expires_in: number };

  const entry = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  if (channel === "qron") _qronTokenCache = entry; else _tokenCache = entry;
  return json.access_token;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  embedUrl: string;
}

export interface UploadParams {
  /** Publicly accessible video URL (e.g. HeyGen output URL) */
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  category?: string;   // YouTube category ID ("22" = People & Blogs, "28" = Science & Tech)
  privacy?: "public" | "unlisted" | "private";
  channel?: "authichain" | "qron";
}

// ─── List channel videos ───────────────────────────────────────────────────

export async function listChannelVideos(opts?: {
  channel?: "authichain" | "qron";
  maxResults?: number;
  pageToken?: string;
}): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
  const channel = opts?.channel ?? "authichain";
  const channelId = channel === "qron"
    ? (process.env.YOUTUBE_QRON_CHANNEL_ID ?? "")
    : (process.env.YOUTUBE_CHANNEL_ID ?? "");
  if (!channelId) return { videos: [] };

  const token = await getAccessToken(channel);
  const params = new URLSearchParams({
    part:          "snippet,statistics",
    channelId,
    type:          "video",
    order:         "date",
    maxResults:    String(opts?.maxResults ?? 20),
    ...(opts?.pageToken ? { pageToken: opts.pageToken } : {}),
  });

  const res = await fetch(`${YT_API_BASE}/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`YouTube list failed: ${await res.text()}`);
  const json = await res.json() as any;

  const videos: YouTubeVideo[] = (json.items ?? []).map((item: any) => {
    const id = item.id?.videoId ?? item.id;
    return {
      id,
      title:        item.snippet?.title ?? "",
      description:  item.snippet?.description ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
      publishedAt:  item.snippet?.publishedAt ?? "",
      viewCount:    item.statistics?.viewCount ?? "0",
      likeCount:    item.statistics?.likeCount ?? "0",
      embedUrl:     `https://www.youtube.com/embed/${id}`,
    };
  });

  return { videos, nextPageToken: json.nextPageToken };
}

// ─── Get single video ──────────────────────────────────────────────────────

export async function getVideoById(videoId: string, channel?: "authichain" | "qron"): Promise<YouTubeVideo | null> {
  const token = await getAccessToken(channel ?? "authichain");
  const params = new URLSearchParams({ part: "snippet,statistics", id: videoId });
  const res = await fetch(`${YT_API_BASE}/videos?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json() as any;
  const item = json.items?.[0];
  if (!item) return null;
  return {
    id: item.id,
    title:        item.snippet?.title ?? "",
    description:  item.snippet?.description ?? "",
    thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? "",
    publishedAt:  item.snippet?.publishedAt ?? "",
    viewCount:    item.statistics?.viewCount ?? "0",
    likeCount:    item.statistics?.likeCount ?? "0",
    embedUrl:     `https://www.youtube.com/embed/${item.id}`,
  };
}

// ─── Upload video ──────────────────────────────────────────────────────────

/**
 * Downloads a video from a URL and uploads it to YouTube via resumable upload.
 * Used to publish HeyGen-generated content automatically.
 */
export async function uploadVideo(params: UploadParams): Promise<{ videoId: string; youtubeUrl: string }> {
  const token = await getAccessToken(params.channel ?? "authichain");

  // Step 1: fetch the video binary
  const videoRes = await fetch(params.videoUrl);
  if (!videoRes.ok) throw new Error(`Failed to fetch video from ${params.videoUrl}`);
  const videoBuffer = await videoRes.arrayBuffer();
  const contentType = videoRes.headers.get("content-type") ?? "video/mp4";

  // Step 2: initiate resumable upload session
  const metadata = {
    snippet: {
      title:      params.title,
      description: params.description,
      tags:       params.tags ?? ["AuthiChain", "QRON", "authentication", "blockchain"],
      categoryId: params.category ?? "28",
    },
    status: { privacyStatus: params.privacy ?? "public" },
  };

  const initRes = await fetch(
    `${YT_UPLOAD_URL}?uploadType=resumable&part=snippet,status`,
    {
      method: "POST",
      headers: {
        Authorization:           `Bearer ${token}`,
        "Content-Type":          "application/json",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(videoBuffer.byteLength),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) throw new Error(`YouTube upload init failed: ${await initRes.text()}`);
  const uploadUri = initRes.headers.get("Location");
  if (!uploadUri) throw new Error("YouTube did not return an upload URI");

  // Step 3: upload video binary
  const uploadRes = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type":   contentType,
      "Content-Length": String(videoBuffer.byteLength),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) throw new Error(`YouTube upload failed: ${await uploadRes.text()}`);
  const uploadJson = await uploadRes.json() as { id: string };
  const videoId = uploadJson.id;

  return { videoId, youtubeUrl: `https://www.youtube.com/watch?v=${videoId}` };
}

// ─── Get channel stats ─────────────────────────────────────────────────────

export async function getChannelStats(channel?: "authichain" | "qron"): Promise<{
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
} | null> {
  const ch = channel ?? "authichain";
  const channelId = ch === "qron"
    ? (process.env.YOUTUBE_QRON_CHANNEL_ID ?? "")
    : (process.env.YOUTUBE_CHANNEL_ID ?? "");
  if (!channelId) return null;

  const token = await getAccessToken(ch);
  const params = new URLSearchParams({ part: "statistics", id: channelId });
  const res = await fetch(`${YT_API_BASE}/channels?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json() as any;
  const stats = json.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    subscriberCount: stats.subscriberCount ?? "0",
    viewCount:       stats.viewCount ?? "0",
    videoCount:      stats.videoCount ?? "0",
  };
}
