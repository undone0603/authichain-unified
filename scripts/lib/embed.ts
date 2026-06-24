// scripts/lib/embed.ts
// Cascading embedding provider chain. Tries providers in order and falls
// back on rate-limits / auth errors / missing keys. All vectors are padded
// or truncated to TARGET_DIM so the existing Pinecone index (1536-dim,
// created against OpenAI text-embedding-3-small) stays compatible.
//
// Providers are enabled by presence of their env var. A deterministic
// hash-based fallback runs last and only when EMBED_HASH_FALLBACK=true.
// Activate the hash fallback only to keep the pipeline alive in emergencies —
// those vectors carry no semantic signal and will poison downstream scoring.

import { createHash } from 'node:crypto';

const TARGET_DIM = Number(process.env.EMBED_TARGET_DIM ?? 1536);

let warnedHashFallback = false;
let warnedSkippedProviders = false;

type Provider = {
  name: string;
  enabled: () => boolean;
  run: (text: string) => Promise<number[]>;
};

const providers: Provider[] = [
  {
    name: 'openai:text-embedding-3-small',
    enabled: () => !!process.env.OPENAI_API_KEY,
    run: async (text) => {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return res.data[0].embedding;
    },
  },
  {
    name: 'cloudflare:@cf/baai/bge-base-en-v1.5',
    enabled: () =>
      !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    run: async (text) => {
      const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`CF ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      const vec = json?.result?.data?.[0];
      if (!Array.isArray(vec)) throw new Error(`CF malformed: ${JSON.stringify(json).slice(0, 200)}`);
      return vec;
    },
  },
  {
    name: 'google:text-embedding-004',
    enabled: () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    run: async (text) => {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
        }
      );
      if (!res.ok) throw new Error(`Gemini ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.embedding.values;
    },
  },
  {
    name: 'huggingface:sentence-transformers/all-mpnet-base-v2',
    enabled: () =>
      !!(
        process.env.HF_TOKEN ||
        process.env.HF_TOKEN_PRIMARY ||
        process.env.HUGGINGFACE_TOKEN ||
        process.env.HUGGINGFACE_API_KEY
      ),
    run: async (text) => {
      const key =
        process.env.HF_TOKEN ||
        process.env.HF_TOKEN_PRIMARY ||
        process.env.HUGGINGFACE_TOKEN ||
        process.env.HUGGINGFACE_API_KEY;
      // Current HF Inference path (router-based). Old api-inference.huggingface.co/pipeline/*
      // paths return 404 as of late 2025.
      const res = await fetch(
        'https://router.huggingface.co/hf-inference/models/sentence-transformers/all-mpnet-base-v2/pipeline/feature-extraction',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
        }
      );
      if (!res.ok) throw new Error(`HF ${res.status} ${(await res.text()).slice(0, 200)}`);
      const out = (await res.json()) as any;
      return Array.isArray(out[0]) ? out[0] : out;
    },
  },
  {
    name: 'cohere:embed-english-light-v3.0',
    enabled: () => !!process.env.COHERE_API_KEY,
    run: async (text) => {
      const res = await fetch('https://api.cohere.com/v1/embed', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [text],
          model: 'embed-english-light-v3.0',
          input_type: 'search_document',
        }),
      });
      if (!res.ok) throw new Error(`Cohere ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.embeddings[0];
    },
  },
  {
    name: 'jina:jina-embeddings-v3',
    enabled: () => !!process.env.JINA_API_KEY,
    run: async (text) => {
      const res = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.JINA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'jina-embeddings-v3', input: [text] }),
      });
      if (!res.ok) throw new Error(`Jina ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.data[0].embedding;
    },
  },
  {
    name: 'mistral:mistral-embed',
    enabled: () => !!process.env.MISTRAL_API_KEY,
    run: async (text) => {
      const res = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'mistral-embed', input: [text] }),
      });
      if (!res.ok) throw new Error(`Mistral ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.data[0].embedding;
    },
  },
  {
    name: 'voyage:voyage-3-lite',
    enabled: () => !!process.env.VOYAGE_API_KEY,
    run: async (text) => {
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'voyage-3-lite', input: [text] }),
      });
      if (!res.ok) throw new Error(`Voyage ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as any;
      return json.data[0].embedding;
    },
  },
  {
    name: 'deterministic-hash-fallback',
    enabled: () => process.env.EMBED_HASH_FALLBACK !== 'false',
    run: async (text) => {
      // Not semantically meaningful — keeps the pipeline alive so downstream
      // storage / workflow bookkeeping still runs. Disable with EMBED_HASH_FALLBACK=false.
      if (!warnedHashFallback) {
        console.warn(
          '⚠️  Using deterministic-hash-fallback for embeddings. ' +
            'Vectors carry no semantic signal — downstream similarity search will be meaningless. ' +
            'Add one of OPENAI_API_KEY / CLOUDFLARE_API_TOKEN (Workers AI scope) / GEMINI_API_KEY / ' +
            'HUGGINGFACE_API_KEY / COHERE_API_KEY / JINA_API_KEY / MISTRAL_API_KEY / VOYAGE_API_KEY ' +
            'to restore semantic embeddings.'
        );
        warnedHashFallback = true;
      }
      const bytesNeeded = TARGET_DIM * 4;
      const chunks: Buffer[] = [];
      let seed = text;
      let total = 0;
      while (total < bytesNeeded) {
        const h = createHash('sha256').update(seed).digest();
        chunks.push(h);
        total += h.length;
        seed = h.toString('hex');
      }
      const buf = Buffer.concat(chunks).subarray(0, bytesNeeded);
      const raw = new Array(TARGET_DIM);
      for (let i = 0; i < TARGET_DIM; i++) {
        raw[i] = (buf.readUInt32BE(i * 4) / 0xffffffff) * 2 - 1;
      }
      const mag = Math.sqrt(raw.reduce((s, x) => s + x * x, 0)) || 1;
      return raw.map((x) => x / mag);
    },
  },
];

function normalizeDim(vec: number[], target = TARGET_DIM): number[] {
  if (vec.length === target) return vec;
  if (vec.length < target) return [...vec, ...new Array(target - vec.length).fill(0)];
  return vec.slice(0, target);
}

export async function embed(
  text: string
): Promise<{ vector: number[]; provider: string }> {
  const enabled = providers.filter((p) => p.enabled());
  if (enabled.length === 0) {
    throw new Error(
      'No embedding providers configured. Set at least one of: OPENAI_API_KEY, CLOUDFLARE_API_TOKEN+CLOUDFLARE_ACCOUNT_ID, GEMINI_API_KEY, HUGGINGFACE_API_KEY, COHERE_API_KEY, JINA_API_KEY, MISTRAL_API_KEY, VOYAGE_API_KEY — or EMBED_HASH_FALLBACK=true.'
    );
  }

  const errors: string[] = [];
  for (const p of enabled) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const vec = await p.run(text);
        if (!Array.isArray(vec) || vec.length === 0) {
          throw new Error('empty vector');
        }
        if (errors.length > 0 && !warnedSkippedProviders) {
          console.warn(
            `ℹ️  embed() fell through failed providers before landing on ${p.name}:\n   - ${errors.join('\n   - ')}`
          );
          warnedSkippedProviders = true;
        }
        return { vector: normalizeDim(vec), provider: p.name };
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
  throw new Error(
    `All embedding providers failed after cascade:\n  - ${errors.join('\n  - ')}`
  );
}

export const EMBED_TARGET_DIM = TARGET_DIM;
