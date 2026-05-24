import { generateLivingQR } from '../hf-generation';
import { logAutomation } from '../automation';

/**
 * GILMORE AUTOMOTIVE ART PIPELINE
 * Specialized pipeline for generating cinematic automotive museum art.
 */

export interface GilmoreArtRequest {
  carModel: string;
  year: string;
  style?: 'classic_photo' | 'brushed_aluminum' | 'blueprint' | 'neon_night';
  destinationUrl: string;
}

const STYLE_PROMPTS: Record<string, string> = {
  classic_photo: 'Elegant museum photography, soft studio lighting, high-contrast reflections, 8k photorealistic, cinematic automotive portrait',
  brushed_aluminum: 'Industrial brushed metal texture, CNC machined finish, metallic silver and slate blue, technical precision, automotive engineering',
  blueprint: 'Technical blueprint drawing, white ink on deep blue engineering paper, architectural lines, schematic automotive design, clean and sharp',
  neon_night: 'Cyberpunk aesthetic, vibrant neon reflections on wet asphalt, glowing pink and cyan highlights, futuristic automotive night shot'
};

export async function generateGilmoreArt(request: GilmoreArtRequest) {
  const { carModel, year, style = 'classic_photo', destinationUrl } = request;
  
  const basePrompt = `${year} ${carModel} at the Gilmore Car Museum`;
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.classic_photo;
  const finalPrompt = `${basePrompt}. ${stylePrompt}`;

  console.log(`[Gilmore-Pipeline] Starting generation for ${year} ${carModel} (${style})`);

  try {
    const gen = await generateLivingQR({
      url: destinationUrl,
      prompt: finalPrompt,
      qr_weight: 1.45, // Slightly higher for museum environments
      start_step: 0.3,  // Earlier start for better fusion with car shapes
    });

    await logAutomation('gilmore_art_pipeline', 'event', 'success', {
      carModel,
      year,
      style,
      imageUrl: gen.imageUrl
    });

    return gen;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Gilmore-Pipeline] Generation failed:`, err);
    
    await logAutomation('gilmore_art_pipeline', 'event', 'failure', {
      carModel,
      year,
      style
    }, msg);
    
    throw err;
  }
}
