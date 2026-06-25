import { config } from 'dotenv';
// The AI Gateway key lives in .env.local (dotenv defaults to .env, so point it
// explicitly). Loading it into process.env lets the AI SDK's gateway provider
// pick up AI_GATEWAY_API_KEY automatically for the 'google/...' model string.
config({ path: '.env.local' });

import { generateText } from 'ai';
import { writeFile } from 'node:fs/promises';

async function main() {
  const prompt =
    process.argv.slice(2).join(' ') ||
    'A photorealistic close-up of a golden retriever puppy wearing tiny sunglasses, sitting on a sunny beach at sunset, shallow depth of field';

  console.log(`Generating image with google/gemini-3.1-flash-image-preview\nPrompt: "${prompt}"\n`);

  const result = await generateText({
    // Routed through Vercel AI Gateway via AI_GATEWAY_API_KEY.
    model: 'google/gemini-3.1-flash-image-preview',
    prompt,
  });

  // Gemini flash-image models return the generated image(s) as files on the
  // result, not as text.
  const images = result.files.filter((f) => f.mediaType?.startsWith('image/'));

  if (images.length === 0) {
    console.error('No image was returned. Model text output was:\n', result.text);
    process.exitCode = 1;
    return;
  }

  let index = 0;
  for (const image of images) {
    const ext = image.mediaType.split('/')[1]?.split(';')[0] || 'png';
    const filename = images.length > 1 ? `output-${index++}.${ext}` : `output.${ext}`;
    await writeFile(filename, image.uint8Array);
    console.log(`Saved ${filename} (${image.mediaType}, ${image.uint8Array.length} bytes)`);
  }

  if (result.usage) {
    console.log('\nToken usage:', result.usage);
  }
}

main().catch((error) => {
  console.error('Image generation failed:', error);
  process.exit(1);
});
