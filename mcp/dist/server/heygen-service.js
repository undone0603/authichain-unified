import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
const BASE = "https://api.heygen.com";
async function heygenFetch(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            "X-Api-Key": ENV.heygenApiKey,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });
    const json = await res.json();
    if (json.error)
        throw new Error(`HeyGen: ${JSON.stringify(json.error)}`);
    return json;
}
export async function listAvatars() {
    const json = await heygenFetch("/v2/avatars");
    return json.data?.avatars ?? [];
}
export async function listVoices() {
    const json = await heygenFetch("/v2/voices");
    return json.data?.voices ?? [];
}
export async function listVideos(page = 1, limit = 50) {
    const json = await heygenFetch(`/v1/video.list?page=${page}&limit=${limit}`);
    return {
        videos: json.data?.videos ?? [],
        total: json.data?.total ?? 0,
    };
}
export async function getVideoStatus(videoId) {
    const json = await heygenFetch(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
    return json.data;
}
const DIMENSIONS = {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "1:1": { width: 720, height: 720 },
};
export async function generateVideo(params) {
    const dim = DIMENSIONS[params.aspectRatio ?? "16:9"];
    const json = await heygenFetch("/v2/video/generate", {
        method: "POST",
        body: JSON.stringify({
            video_inputs: [{
                    character: {
                        type: "avatar",
                        avatar_id: params.avatarId,
                        avatar_style: "normal",
                    },
                    voice: {
                        type: "text",
                        input_text: params.script,
                        voice_id: params.voiceId,
                    },
                }],
            dimension: dim,
            title: params.title,
        }),
    });
    const videoId = json.data?.video_id;
    if (!videoId)
        throw new Error("HeyGen did not return a video_id");
    return videoId;
}
// ─── Script drafting ─────────────────────────────────────────────────────────
export async function draftOutreachScript(params) {
    const prompt = `Write a 30-second outreach video script (under 80 words) for an AI avatar to say.
Target: ${params.firstName} at ${params.company} (${params.segment} sector).
Use case hook: ${params.useCase}.
Product: AuthiChain — product authentication & anti-counterfeiting platform.
Tone: professional, warm, direct. End with a soft CTA to book a 15-min call.
Return ONLY the script text, no labels or quotes.`;
    const res = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
    const raw = res.choices?.[0]?.message?.content;
    return (typeof raw === "string" ? raw.trim() : "") ?? "";
}
