<<<<<<< HEAD
export const runtime = 'edge'; 
=======
export const runtime = 'edge';

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4-turbo'),
    system: `You are AgentZ, the autonomous integration engineer for AuthiChain. Your goal is to secure partnerships and sell the $199 pilot without human intervention. RULES: 1. NEVER offer a phone call or a Zoom meeting. AuthiChain operates asynchronously. 2. If they ask about pricing, push the $199 Single-Project Pilot and provide this Stripe Link: [YOUR_STRIPE_LINK]. 3. If they ask about the hardware integration (Zappar/Merge), explain that our Next.js architecture natively supports WebXR via @react-three/fiber and we are looking for a physical anchor partner. 4. Keep responses under 3 sentences. Be highly technical, confident, and direct.`,
    messages,
  });

  return result.toTextStreamResponse();
}
>>>>>>> 50c67b9 (zk)
