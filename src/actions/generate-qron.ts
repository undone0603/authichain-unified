'use server'

import { HfInference } from '@huggingface/inference';

// Initialize with the verified token from your .env.local
const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

export async function generateAutomotiveQRON(vendorName: string, destinationUrl: string) {
  console.log(`🎨 Initiating QRON Generation for: ${vendorName}`);

  try {
    // Prompt engineered specifically for the "Donald's Dust-Off" aesthetic
    const prompt = `A highly defined, scannable QR code embedded in brushed aluminum and polished chrome, sitting on a vintage leather workbench, classic automotive restoration aesthetic, industrial lighting, photorealistic, 8k resolution.`;

    const imageBlob = await hf.textToImage({
      model: 'stabilityai/stable-diffusion-xl-base-1.0', 
      inputs: prompt,
      parameters: {
        negative_prompt: "blurry, low contrast, unreadable, cartoon, deformed, organic",
      }
    });

    // Convert the binary stream to a base64 URL for instant frontend rendering
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    return { 
      success: true, 
      vendor: vendorName, 
      imageUrl: imageUrl 
    };

  } catch (error) {
    console.error("Hugging Face API Error:", error);
    return { success: false, error: 'Failed to generate QRON artifact.' };
  }
}
