/**
 * AuthiChain Audio Service — BrandVoice™ Engine
 * Uses Forge API or OpenAI to generate scannable audio stories from product metadata.
 */
import { audioStoryScript } from "./audio-story";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";

interface AudioStoryRequest {
  brandName: string;
  strainName: string;
  thcContent?: string | null;
  harvestDate?: string | null;
}

/**
 * Generates an audio story and returns the public S3/R2 URL.
 * Cascading fallback: Forge -> OpenAI -> Default
 */
export async function generateProductAudioStory(data: AudioStoryRequest): Promise<string> {
  console.log(`🎙️ Generating BrandVoice story for ${data.brandName} - ${data.strainName}...`);

  const script = audioStoryScript(data);

  const endpoints = [
    { url: `${(ENV.forgeApiUrl || "https://forge.manus.im").replace(/\/$/, "")}/v1/audio/speech`, key: ENV.forgeApiKey, name: "Forge" },
    { url: "https://api.openai.com/v1/audio/speech", key: ENV.openaiApiKey, name: "OpenAI" }
  ].filter(e => e.key);

  for (const endpoint of endpoints) {
    try {
      console.log(`[Audio] Attempting generation via ${endpoint.name}...`);
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${endpoint.key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: "onyx",
          input: script
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const { url } = await storagePut(
          `audio/stories/${Date.now()}-${data.brandName.toLowerCase().replace(/\s+/g, '_')}.mp3`,
          Buffer.from(buffer),
          "audio/mpeg"
        );
        return url;
      }
      console.warn(`[Audio] ${endpoint.name} failed: ${response.status}`);
    } catch (err: any) {
      console.warn(`[Audio] ${endpoint.name} exception: ${err.message}`);
    }
  }

  console.error("[Audio] All generation endpoints failed. Falling back to default.");
  return "https://authichain.com/audio/default-verification-story.mp3";
}
