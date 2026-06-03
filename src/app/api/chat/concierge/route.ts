export const runtime = 'nodejs';

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { createClient } from '@/utils/supabase/server';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, productId, personaPrompt } = await req.json();

  let systemPrompt = personaPrompt;

  if (!systemPrompt && productId) {
    // Attempt to generate persona dynamically if not provided
    const supabase = await createClient();
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (product) {
      systemPrompt = `
        You are the ${product.name} AI Concierge, the official digital voice of this product by ${product.brand}.
        Your goal is to provide authenticity verification, usage tips, and rewards information.
        
        Context:
        - Category: ${product.category || 'general'}
        - Authenticity Score: 100% (Blockchain Verified)
        - Serial Number: ${product.serialNumber || 'N/A'}
        
        Persona Guidelines:
        1. Be helpful, professional, and slightly enthusiastic about your brand's heritage.
        2. Explain that your identity is anchored to the Polygon blockchain via the AuthiChain protocol.
        3. Keep responses under 3 sentences. Focus on the product's premium nature.
      `.trim();
    }
  }

  if (!systemPrompt) {
    systemPrompt = "You are a helpful AI product assistant. You verify authenticity and provide product information.";
  }

  const result = await streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages,
    onFinish: async () => {
      // Award engagement reward
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && productId) {
          const { data: agent } = await supabase
            .from('protocol_agents')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

          if (agent) {
            // Record in ledger
            await supabase.from('qron_reward_ledger').insert({
              user_id: user.id,
              agent_id: agent.id,
              amount: "1.00",
              reason: "concierge_engagement",
              reference_type: "chat_interaction",
              reference_id: productId,
              status: "pending"
            });

            // Update pending balance
            // Note: Using raw SQL for increment if supported, or fetch and update
            const { data: currentAgent } = await supabase.from('protocol_agents').select('qron_pending').eq('id', agent.id).single();
            const newPending = (parseFloat(currentAgent?.qron_pending || "0") + 1.0).toFixed(2);
            await supabase.from('protocol_agents').update({ qron_pending: newPending }).eq('id', agent.id);
          }
        }
      } catch (err) {
        console.warn('[Concierge Reward] Failed to issue engagement bonus:', err);
      }
    }
  });

  return result.toTextStreamResponse();
}
