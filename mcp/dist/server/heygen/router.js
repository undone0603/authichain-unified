import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
const HEYGEN_BASE = "https://api.heygen.com";
async function heygenGet(path) {
    const key = process.env.HEYGEN_API_KEY;
    if (!key)
        throw new Error("HEYGEN_API_KEY not configured");
    const res = await fetch(`${HEYGEN_BASE}${path}`, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
    });
    if (!res.ok)
        throw new Error(`HeyGen API error ${res.status}`);
    return res.json();
}
async function heygenPost(path, body) {
    const key = process.env.HEYGEN_API_KEY;
    if (!key)
        throw new Error("HEYGEN_API_KEY not configured");
    const res = await fetch(`${HEYGEN_BASE}${path}`, {
        method: "POST",
        headers: { "X-Api-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HeyGen API error ${res.status}: ${text}`);
    }
    return res.json();
}
export const heygenRouter = router({
    status: protectedProcedure.query(async () => {
        const configured = !!process.env.HEYGEN_API_KEY;
        if (!configured)
            return { configured, credits: 0 };
        try {
            const data = await heygenGet("/v2/user/remaining_quota");
            return { configured, credits: data.data?.remaining_quota ?? 0 };
        }
        catch {
            return { configured, credits: 0 };
        }
    }),
    avatars: protectedProcedure.query(async () => {
        const data = await heygenGet("/v2/avatars");
        return (data.data?.avatars ?? []);
    }),
    voices: protectedProcedure.query(async () => {
        const data = await heygenGet("/v2/voices");
        return (data.data?.voices ?? []);
    }),
    generateVideo: protectedProcedure
        .input(z.object({
        avatarId: z.string(),
        voiceId: z.string(),
        script: z.string().max(2000),
        title: z.string().optional(),
        backgroundHex: z.string().default("#1a1a2e"),
    }))
        .mutation(async ({ input }) => {
        const data = await heygenPost("/v2/video/generate", {
            video_inputs: [
                {
                    character: {
                        type: "avatar",
                        avatar_id: input.avatarId,
                        avatar_style: "normal",
                    },
                    voice: {
                        type: "text",
                        input_text: input.script,
                        voice_id: input.voiceId,
                    },
                    background: { type: "color", value: input.backgroundHex },
                },
            ],
            dimension: { width: 1280, height: 720 },
            ...(input.title ? { title: input.title } : {}),
        });
        return { videoId: data.data?.video_id };
    }),
    videoStatus: protectedProcedure
        .input(z.object({ videoId: z.string() }))
        .query(async ({ input }) => {
        const data = await heygenGet(`/v1/video_status.get?video_id=${input.videoId}`);
        const v = data.data ?? {};
        return {
            status: v.status,
            video_url: v.video_url,
            thumbnail_url: v.thumbnail_url,
            duration: v.duration,
            error: v.error,
        };
    }),
});
