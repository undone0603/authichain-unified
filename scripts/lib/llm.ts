// scripts/lib/llm.ts
// Cascading chat-completion provider chain. Mirrors scripts/lib/embed.ts but
// for text generation. Tries providers in order and falls back on rate-limits
// / auth errors / missing keys. All providers support JSON mode when
// `jsonMode: true` is requested.
//
// Provider order is zero-budget-first: local model, then free tiers, then
// paid APIs only as a last resort (the startup runs on $0 until sales).
//   1. Local gemma-4-e4b            — FREE, LOCAL_MODEL_URL (LM Studio)
//   2. Local nemotron-3-nano-4b     — FREE, same server, fallback model
//   3. Groq llama-3.3-70b-versatile — FREE, ~100k tokens/day, fastest inference
//   4. Groq llama-3.1-8b-instant    — FREE, ~500k tokens/day (separate bucket)
//   5. Gemini Flash (latest)        — free tier
//   6. HF router Llama-3.3-70B      — free monthly credits (HUGGINGFACE_API_KEY)
//   7. Mistral open-mixtral-8x7b    — free tier
//   8. OpenAI                       — PAID, last resort
//   9. Claude Haiku (Anthropic)     — PAID, last resort
//
// A provider that fails hard is skipped so later calls don't re-pay its
// retry/backoff cost: auth errors disable it for the rest of the process,
// quota 429s put it on a short cooldown (Gemini uses the same wording for
// per-minute rate limits and daily caps).
//
// Enable a provider by setting its env var. Missing keys are silently skipped.
// Groq 70B and 8B both use GROQ_API_KEY but consume separate rate-limit pools,
// so keeping both in the cascade meaningfully improves resilience.

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

const MAX_ATTEMPTS_PER_PROVIDER = 3;
// Exponential backoff (ms) with jitter added on top.
const BACKOFF_SCHEDULE_MS = [2000, 5000, 10000];

// Circuit breaker: providers that failed hard are skipped instead of
// re-eating their retry/backoff budget on every chat() call (~18s per call
// when OpenAI is out of quota).
//  - Auth errors (bad key) never recover within a run -> disabled forever.
//  - Quota 429s get a cooldown, not a permanent ban: Gemini uses the same
//    "exceeded your current quota" wording for per-minute rate limits (which
//    recover in seconds) and daily caps (which don't).
const providerCooldown = new Map<string, { until: number; reason: string }>();
const AUTH_ERROR_RE = /invalid_api_key|authentication|unauthorized|\b401\b|\b403\b/i;
const QUOTA_ERROR_RE = /insufficient_quota|exceeded your current quota|check your plan and billing/i;
const QUOTA_COOLDOWN_MS = 120_000;

function makeGroqProvider(model: string): Provider {
  return {
    name: `groq:${model}`,
    enabled: () => !!process.env.GROQ_API_KEY,
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
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
  };
}

// Local OpenAI-compatible server (LM Studio). Free and unlimited, so it runs
// first. This LM Studio build rejects response_format json_object, so JSON
// mode is enforced by instruction plus fence-stripping. A hung local server
// is a real observed failure mode — every request carries a hard timeout, and
// network failures disable the provider for the rest of the run (see chat()).
function localModelBase(): string {
  let base = (process.env.LOCAL_MODEL_URL ?? '').replace(/\/+$/, '');
  if (base && !/\/v1$/.test(base)) base += '/v1';
  return base;
}
const LOCAL_MODEL_TIMEOUT_MS = Number(process.env.LOCAL_MODEL_TIMEOUT_MS ?? 120_000);

// Two local entries against the same server (mirrors the two-Groq-model
// pattern): if the primary model fails to load or misbehaves, the fallback
// model gets a shot. A server-level failure (unreachable/hung) disables every
// local: entry at once in chat().
function makeLocalProvider(displayName: string, envKey: string, defaultModel: string): Provider {
  return {
    name: `local:${displayName}`,
    enabled: () => !!process.env.LOCAL_MODEL_URL,
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const msgs = jsonMode
        ? [
            {
              role: 'system' as const,
              content: 'Respond with ONLY valid JSON. No markdown fences, no commentary.',
            },
            ...messages,
          ]
        : messages;
      const res = await fetch(`${localModelBase()}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env[envKey] || defaultModel,
          messages: msgs,
          temperature: temperature ?? 0.2,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(LOCAL_MODEL_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Local ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      let content: string = json.choices?.[0]?.message?.content ?? '';
      if (jsonMode) {
        content = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
      }
      return content;
    },
  };
}

const providers: Provider[] = [
  makeLocalProvider('gemma-4-e4b', 'LOCAL_MODEL_ID', 'google/gemma-4-e4b'),
  makeLocalProvider('nemotron-3-nano-4b', 'LOCAL_MODEL_ID_FALLBACK', 'nvidia/nemotron-3-nano-4b'),
  makeGroqProvider('llama-3.3-70b-versatile'),
  makeGroqProvider('llama-3.1-8b-instant'),
  {
    name: 'google:gemini-flash-latest',
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
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
    // Hugging Face Inference Providers router (OpenAI-compatible). Uses the
    // HUGGINGFACE_API_KEY that already exists as a repo secret; free monthly
    // inference credits make this a working fallback when Gemini rate-limits.
    name: 'huggingface:llama-3.3-70b',
    enabled: () => !!(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN),
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const key = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
      const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/Llama-3.3-70B-Instruct',
          messages,
          temperature: temperature ?? 0.2,
          max_tokens: maxTokens,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HuggingFace ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.choices?.[0]?.message?.content ?? '';
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
  // ── Paid providers: last resort only (zero-budget policy) ─────────────────
  {
    name: 'openai',
    enabled: () => !!process.env.OPENAI_API_KEY,
    run: async ({ messages, jsonMode, temperature, maxTokens, openaiModel }) => {
      const { default: OpenAI } = await import('openai');
      // The cascade owns retry logic; the SDK's internal retries only add latency.
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
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
    name: 'anthropic:claude-haiku-4-5',
    enabled: () => !!process.env.ANTHROPIC_API_KEY,
    run: async ({ messages, jsonMode, temperature, maxTokens }) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: maxTokens ?? 1024,
          temperature: temperature ?? 0.2,
          system: messages.find((m) => m.role === 'system')?.content,
          messages: messages
            .filter((m) => m.role !== 'system')
            .map((m) => ({ role: m.role, content: m.content })),
          ...(jsonMode ? { system: (messages.find((m) => m.role === 'system')?.content ?? '') + '\nRespond with valid JSON only.' } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.content?.[0]?.text ?? '';
    },
  },
];

export async function chat(
  options: ChatOptions
): Promise<{ content: string; provider: string }> {
  const now = Date.now();
  const enabled = providers.filter(
    (p) => p.enabled() && (providerCooldown.get(p.name)?.until ?? 0) <= now
  );
  if (enabled.length === 0) {
    const dead = [...providerCooldown.entries()].map(([n, e]) => `${n}: ${e.reason}`).join('\n  - ');
    throw new Error(
      'No usable LLM providers. Set at least one of: OPENAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, HUGGINGFACE_API_KEY, MISTRAL_API_KEY.' +
        (dead ? `\nProviders currently disabled after hard failures:\n  - ${dead}` : '')
    );
  }

  const errors: string[] = [];
  for (const p of enabled) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      try {
        const content = await p.run(options);
        if (!content || typeof content !== 'string') {
          throw new Error('empty completion');
        }
        if (errors.length > 0) {
          // Logged on every call, not just the first, so a run's log shows
          // exactly which provider is actually serving each opportunity --
          // a "quota cooldown" on the primary free provider is silent
          // otherwise, hiding whether the configured fallbacks are covering
          // for it or are themselves dead (e.g. an expired key that only
          // fails once cooldown routes traffic to it).
          console.warn(
            `ℹ️  chat() fell through failed providers before landing on ${p.name}:\n   - ${errors.join('\n   - ')}`
          );
        }
        return { content, provider: p.name };
      } catch (err: any) {
        const msg = err?.message || String(err);
        errors.push(`${p.name} (try ${attempt + 1}): ${msg.slice(0, 160)}`);
        if (p.name.startsWith('local:')) {
          // Unreachable server (ECONNREFUSED/ENOTFOUND) and a malformed/empty
          // LOCAL_MODEL_URL (fetch's "Failed to parse URL") are both
          // categorically dead for the rest of the run -- e.g. a CI runner can
          // never reach a URL that only resolves on the operator's own
          // machine, and no retry fixes a URL that doesn't parse. Disable
          // every local: entry immediately instead of re-paying this cost on
          // each of the run's opportunities.
          if (/ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|fetch failed|Failed to parse URL/i.test(msg)) {
            for (const lp of providers) {
              if (lp.name.startsWith('local:')) {
                providerCooldown.set(lp.name, { until: Infinity, reason: msg.slice(0, 120) });
              }
            }
            console.warn('⚠️  Local model server unreachable or misconfigured — disabling all local providers for this run.');
            break;
          }
          if (/abort|timed?\s?out|TimeoutError/i.test(msg)) {
            // Timeout may be model-specific (JIT load hang): disable only this
            // entry so the fallback local model still gets a shot.
            providerCooldown.set(p.name, { until: Infinity, reason: msg.slice(0, 120) });
            console.warn(`⚠️  Disabling provider ${p.name} for this run (request timed out).`);
            break;
          }
        }
        // Bad key never recovers within a run: disable the provider outright.
        if (AUTH_ERROR_RE.test(msg)) {
          providerCooldown.set(p.name, { until: Infinity, reason: msg.slice(0, 120) });
          console.warn(`⚠️  Disabling provider ${p.name} for this run (auth error).`);
          break;
        }
        const quota = QUOTA_ERROR_RE.test(msg);
        const transient = /429|rate.?limit|5\d{2}|timeout|ETIMEDOUT|ECONNRESET/i.test(msg);
        // Only retry on transient errors, and only if we have attempts left.
        if (transient && !quota && attempt < MAX_ATTEMPTS_PER_PROVIDER - 1) {
          const base = BACKOFF_SCHEDULE_MS[attempt] ?? 10000;
          const jitter = Math.random() * 500;
          await new Promise((r) => setTimeout(r, base + jitter));
          continue;
        }
        // Quota-style 429s (OpenAI billing, Gemini per-minute/daily caps) fail
        // fast and cool the provider down instead of burning the retry budget.
        if (quota) {
          providerCooldown.set(p.name, {
            until: Date.now() + QUOTA_COOLDOWN_MS,
            reason: msg.slice(0, 120),
          });
          console.warn(`⚠️  Cooling down provider ${p.name} for ${QUOTA_COOLDOWN_MS / 1000}s (quota).`);
        }
        break;
      }
    }
  }
  throw new Error(`All LLM providers failed after cascade:\n  - ${errors.join('\n  - ')}`);
}
