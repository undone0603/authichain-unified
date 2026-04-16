// scripts/lib/llm.ts
// Cascading chat-completion provider chain. Mirrors scripts/lib/embed.ts but
// for text generation. Tries providers in order and falls back on rate-limits
// / auth errors / missing keys. All providers support JSON mode when
// `jsonMode: true` is requested.
//
// Provider order is cost-optimized for the gov-engine pipeline:
//   1. OpenAI     — best quality, paid
//   2. Groq       — llama-3.3-70b, FREE 14.4k req/day, fastest inference
//   3. Gemini     — gemini-1.5-flash, free tier
//   4. Mistral    — open-mixtral-8x7b, free tier
//
// Enable a provider by setting its env var. Missing keys are silently skipped.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatOptions = {
  messages: ChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  // Optional caller hint for which OpenAI tier to request. Other providers
  // use their own default model regardless.
  openaiModel?: string;
};

type Provider = {
  name: string;
  enabled: () => boolean;
  run: (options: ChatOptions) => Promise<string>;
};

let warnedSkippedProviders = false;

const providers: Provider[] = [
  {
    name: 'openai',
    enabled: () => !!process.env.OPENAI_API_KEY,
    run: async ({ messages, jsonMode, temperature, maxTokens, openaiModel }) => {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: openaiModel ?? 'gpt-4o-mini',
        messages,
        temperature: temperature ?? 0.2,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: 'json_object' } : undefined,
      });
      return res.choices[0]?.message?.content ?? '';
    },
  },
  {
    name: 'groq:llama-3.3-70b-versatile',
    enabled: () => !!process.env.GROQ_API_KEY,
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: temperature ?? 0.2,
          max_tokens: maxTokens,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.choices?.[0]?.message?.content ?? '';
    },
  },
  {
    name: 'google:gemini-1.5-flash',
    enabled: () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      // Fold system + user messages into Gemini's single-content shape.
      const systemInstruction = messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');
      const userContent = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

      const body: any = {
        contents: userContent,
        generationConfig: {
          temperature: temperature ?? 0.2,
          maxOutputTokens: maxTokens,
          ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    },
  },
  {
    name: 'mistral:open-mixtral-8x7b',
    enabled: () => !!process.env.MISTRAL_API_KEY,
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'open-mixtral-8x7b',
          messages,
          temperature: temperature ?? 0.2,
          max_tokens: maxTokens,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`Mistral ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.choices?.[0]?.message?.content ?? '';
    },
  },
];

export async function chat(
  options: ChatOptions
): Promise<{ content: string; provider: string }> {
  const enabled = providers.filter((p) => p.enabled());
  if (enabled.length === 0) {
    throw new Error(
      'No LLM providers configured. Set at least one of: OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY.'
    );
  }

  const errors: string[] = [];
  for (const p of enabled) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const content = await p.run(options);
        if (!content || typeof content !== 'string') {
          throw new Error('empty completion');
        }
        if (errors.length > 0 && !warnedSkippedProviders) {
          console.warn(
            `ℹ️  chat() fell through failed providers before landing on ${p.name}:\n   - ${errors.join('\n   - ')}`
          );
          warnedSkippedProviders = true;
        }
        return { content, provider: p.name };
      } catch (err: any) {
        const msg = err?.message || String(err);
        const transient = /429|rate.?limit|quota|5\d{2}|timeout|ETIMEDOUT|ECONNRESET/i.test(msg);
        errors.push(`${p.name} (try ${attempt + 1}): ${msg.slice(0, 160)}`);
        if (transient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(`All LLM providers failed after cascade:\n  - ${errors.join('\n  - ')}`);
}
