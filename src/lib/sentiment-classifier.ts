import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const SENTIMENTS = [
  "positive",
  "neutral",
  "negative",
  "objection",
] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const OBJECTION_TYPES = [
  "budget",
  "timeline",
  "competitor",
  "decision_maker",
  "other",
] as const;
export type ObjectionType = (typeof OBJECTION_TYPES)[number];

export const CLASSIFIER_PROVIDERS = [
  "openai",
  "ollama",
  "heuristic",
  "neutral_fallback",
] as const;
export type ClassifierProvider = (typeof CLASSIFIER_PROVIDERS)[number];

export interface SentimentResult {
  sentiment: Sentiment;
  objectionType: ObjectionType | null;
  objectionDetails: string | null;
  confidence: number;
  reasoning: string;
  provider: ClassifierProvider;
  /**
   * Why a configured LLM was skipped, when the result came from a fallback
   * (e.g. OpenAI 401/429). Redacted of key material. Absent when the first
   * backend succeeded or none was configured.
   */
  fallbackReason?: string;
}

/** Current, inexpensive model with reliable JSON output. */
export const OPENAI_REPLY_MODEL = "gpt-4o-mini";

/** Error text safe to store and return: key fragments removed, length capped. */
export function describeClassifierError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/sk-[A-Za-z0-9_*-]+/g, "sk-[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export interface ClassifierBackendStatus {
  /** First backend the waterfall will attempt. */
  primary: "openai" | "ollama" | "heuristic";
  /** Paid LLM secret that is absent. Unset when OpenAI can run. */
  missingSecret?: "OPENAI_API_KEY";
  paidLlmAvailable: boolean;
  ollamaHost: string;
  ollamaModel: string;
  waterfall: ClassifierProvider[];
}

export interface ClassifyReplyDeps {
  /** Override env for tests. */
  env?: NodeJS.ProcessEnv;
  /** Override fetch (Ollama HTTP). */
  fetchImpl?: typeof fetch;
  /** Override the OpenAI generateText call. */
  generateOpenAI?: (prompt: string) => Promise<string>;
  /** Override the last-resort heuristic (tests inject a throw to prove fail-closed). */
  heuristic?: (emailBody: string, emailSubject: string) => SentimentResult;
}

const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2";
const OLLAMA_TIMEOUT_MS = 2500;
/**
 * Resend times out an inbound webhook after a few seconds and retries. With
 * the SDK's defaults (2 retries with back-off, no deadline) one slow or failing
 * OpenAI call outlasted it, so the first live reply after #1232 timed out.
 * One attempt with a hard deadline keeps the route under that limit; on
 * timeout the waterfall falls back and records why.
 */
export const OPENAI_TIMEOUT_MS = 8000;

const CLASSIFY_PROMPT_PREAMBLE = `You are an expert sales analyst. Classify this customer reply to a business proposal.`;

export function failClosedNeutral(reason: unknown): SentimentResult {
  const message = reason instanceof Error ? reason.message : String(reason);
  return {
    sentiment: "neutral",
    objectionType: null,
    objectionDetails: null,
    confidence: 0.3,
    reasoning: `Classification failed, defaulting to neutral: ${message}`,
    provider: "neutral_fallback",
  };
}

export function ollamaIsConfigured(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return Boolean(env.OLLAMA_HOST?.trim() || env.OLLAMA_MODEL?.trim());
}

export function resolveReplyClassifierBackend(
  env: NodeJS.ProcessEnv = process.env
): ClassifierBackendStatus {
  const ollamaHost = (env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST).replace(
    /\/$/,
    ""
  );
  const ollamaModel = env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
  const paidLlmAvailable = Boolean(env.OPENAI_API_KEY?.trim());
  const localLlmConfigured = ollamaIsConfigured(env);

  if (paidLlmAvailable) {
    return {
      primary: "openai",
      paidLlmAvailable: true,
      ollamaHost,
      ollamaModel,
      waterfall: localLlmConfigured
        ? ["openai", "ollama", "heuristic", "neutral_fallback"]
        : ["openai", "heuristic", "neutral_fallback"],
    };
  }

  if (localLlmConfigured) {
    return {
      primary: "ollama",
      missingSecret: "OPENAI_API_KEY",
      paidLlmAvailable: false,
      ollamaHost,
      ollamaModel,
      waterfall: ["ollama", "heuristic", "neutral_fallback"],
    };
  }

  // Do not probe 127.0.0.1:11434 on Vercel / production unless an operator
  // opted in with OLLAMA_HOST or OLLAMA_MODEL. That hang would delay inbound.
  return {
    primary: "heuristic",
    missingSecret: "OPENAI_API_KEY",
    paidLlmAvailable: false,
    ollamaHost,
    ollamaModel,
    waterfall: ["heuristic", "neutral_fallback"],
  };
}

export function buildClassifyPrompt(
  emailBody: string,
  emailSubject: string
): string {
  return `${CLASSIFY_PROMPT_PREAMBLE}

Email Subject: ${emailSubject}

Email Body:
${emailBody}

Analyze the sentiment and identify any objections. Return a JSON object with:
- "sentiment": one of "positive" (ready to move forward), "neutral" (info-seeking or non-committal), "negative" (explicit rejection), or "objection" (concern raised with specific blocker)
- "objectionType": if sentiment is "objection", one of: "budget", "timeline", "competitor", "decision_maker", or "other"; otherwise null
- "objectionDetails": if an objection exists, a brief summary of the specific concern; otherwise null
- "confidence": a number from 0.0 to 1.0 indicating how confident you are in this classification
- "reasoning": a brief explanation of your classification (1-2 sentences)

Return ONLY a valid JSON object, no markdown or extra text.`;
}

export function parseSentimentPayload(
  raw: unknown,
  provider: Exclude<ClassifierProvider, "neutral_fallback">
): SentimentResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Classifier payload is not an object");
  }

  const result = raw as Record<string, unknown>;
  const sentiment = result.sentiment;
  if (
    typeof sentiment !== "string" ||
    !SENTIMENTS.includes(sentiment as Sentiment)
  ) {
    throw new Error(`Invalid sentiment: ${String(sentiment)}`);
  }

  let objectionType: ObjectionType | null = null;
  if (sentiment === "objection" && result.objectionType) {
    if (
      typeof result.objectionType !== "string" ||
      !OBJECTION_TYPES.includes(result.objectionType as ObjectionType)
    ) {
      throw new Error(`Invalid objectionType: ${String(result.objectionType)}`);
    }
    objectionType = result.objectionType as ObjectionType;
  }

  return {
    sentiment: sentiment as Sentiment,
    objectionType,
    objectionDetails:
      typeof result.objectionDetails === "string"
        ? result.objectionDetails
        : null,
    confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
    reasoning:
      typeof result.reasoning === "string" && result.reasoning.trim()
        ? result.reasoning
        : "Classification completed",
    provider,
  };
}

export function parseSentimentJson(
  text: string,
  provider: Exclude<ClassifierProvider, "neutral_fallback">
): SentimentResult {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (fenced ? fenced[1] : trimmed).trim();
  return parseSentimentPayload(JSON.parse(jsonText), provider);
}

/**
 * Conservative keyword classifier. Ambiguous copy stays neutral so the
 * nurture cron does not auto-send on a weak signal (fail-closed).
 */
export function classifyReplyEmailHeuristic(
  emailBody: string,
  emailSubject: string
): SentimentResult {
  const text = `${emailSubject}\n${emailBody}`.toLowerCase();

  const negativePatterns = [
    /\bnot interested\b/,
    /\bno thanks\b/,
    /\bno thank you\b/,
    /\bunsubscribe\b/,
    /\bremove me\b/,
    /\bstop (emailing|contacting|email)\b/,
    /\bdon'?t contact\b/,
    /\bnever contact\b/,
    /\bplease stop\b/,
    /\btake me off\b/,
  ];
  if (negativePatterns.some(pattern => pattern.test(text))) {
    return {
      sentiment: "negative",
      objectionType: null,
      objectionDetails: null,
      confidence: 0.62,
      reasoning: "Heuristic: explicit rejection or opt-out language.",
      provider: "heuristic",
    };
  }

  const objections: Array<{
    type: ObjectionType;
    pattern: RegExp;
    details: string;
  }> = [
    {
      type: "budget",
      pattern:
        /\b(too expensive|over budget|can'?t afford|no budget|cost[- ]prohibitive|price is (too )?(high|steep))\b/,
      details: "Budget or price blocker",
    },
    {
      type: "timeline",
      pattern:
        /\b(next quarter|next year|not the right time|too soon|later this year|revisit in|timing (is|isn'?t))\b/,
      details: "Timing / later-date blocker",
    },
    {
      type: "competitor",
      pattern:
        /\b(already using|already have a (vendor|provider|solution)|went with|chose another|another vendor)\b/,
      details: "Incumbent vendor or competitor",
    },
    {
      type: "decision_maker",
      pattern:
        /\b(run this by|talk to my (boss|cto|ceo|cfo|board|committee)|not my decision|need (sign[- ]?off|approval))\b/,
      details: "Needs another decision maker",
    },
  ];
  for (const objection of objections) {
    if (objection.pattern.test(text)) {
      return {
        sentiment: "objection",
        objectionType: objection.type,
        objectionDetails: objection.details,
        confidence: 0.58,
        reasoning: `Heuristic: ${objection.details.toLowerCase()} language.`,
        provider: "heuristic",
      };
    }
  }

  const positivePatterns = [
    /\b(very |really )?(interested|keen)\b/,
    /\blet'?s (talk|chat|proceed|do it|move forward|schedule)\b/,
    /\b(schedule|book) (a |the )?(call|demo|meeting)\b/,
    /\blooking forward\b/,
    /\bready to (move|proceed|start)\b/,
    /\bsend (over )?(the )?(contract|agreement|sow)\b/,
    /\bsounds good\b.*\b(call|demo|meeting|next step)/,
  ];
  if (positivePatterns.some(pattern => pattern.test(text))) {
    return {
      sentiment: "positive",
      objectionType: null,
      objectionDetails: null,
      confidence: 0.6,
      reasoning: "Heuristic: explicit interest or next-step language.",
      provider: "heuristic",
    };
  }

  return {
    sentiment: "neutral",
    objectionType: null,
    objectionDetails: null,
    confidence: 0.4,
    reasoning: "Heuristic: no strong interest, rejection, or objection signal.",
    provider: "heuristic",
  };
}

async function classifyWithOpenAI(
  prompt: string,
  apiKey: string | undefined,
  generateOpenAI?: (prompt: string) => Promise<string>
): Promise<SentimentResult> {
  // Key passed explicitly rather than read from process.env inside the SDK:
  // on Workers the env is per-request bindings, not a process environment.
  const text = generateOpenAI
    ? await generateOpenAI(prompt)
    : (
        await generateText({
          model: createOpenAI({ apiKey })(OPENAI_REPLY_MODEL),
          prompt,
          temperature: 0.3,
          maxOutputTokens: 500,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
        })
      ).text;
  return parseSentimentJson(text, "openai");
}

async function classifyWithOllama(
  prompt: string,
  host: string,
  model: string,
  fetchImpl: typeof fetch
): Promise<SentimentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: prompt }],
        options: { temperature: 0.3, num_predict: 250 },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      message?: { content?: string };
      response?: string;
    };
    const text = data.message?.content ?? data.response ?? "";
    if (!text.trim()) {
      throw new Error("Ollama returned an empty completion");
    }
    return parseSentimentJson(text, "ollama");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classify an inbound email reply.
 *
 * Waterfall (no new paid spend): OpenAI when OPENAI_API_KEY is set, else
 * local Ollama (ChatOllama-compatible /api/chat), else a conservative
 * heuristic. Any unexpected failure fail-closes to neutral so production
 * inbound capture never 500s on a missing LLM.
 */
export async function classifyReplyEmail(
  emailBody: string,
  emailSubject: string,
  deps: ClassifyReplyDeps = {}
): Promise<SentimentResult> {
  const env = deps.env ?? process.env;
  const backend = resolveReplyClassifierBackend(env);
  const prompt = buildClassifyPrompt(emailBody, emailSubject);
  const fetchImpl = deps.fetchImpl ?? fetch;

  let fallbackReason: string | undefined;
  const withReason = (result: SentimentResult): SentimentResult =>
    fallbackReason ? { ...result, fallbackReason } : result;

  try {
    if (backend.paidLlmAvailable) {
      try {
        return await classifyWithOpenAI(
          prompt,
          env.OPENAI_API_KEY?.trim(),
          deps.generateOpenAI
        );
      } catch (error) {
        fallbackReason = `openai: ${describeClassifierError(error)}`;
        console.warn(
          "OpenAI reply classification failed; trying local fallback",
          fallbackReason
        );
      }
    }

    if (ollamaIsConfigured(env)) {
      try {
        return withReason(
          await classifyWithOllama(
            prompt,
            backend.ollamaHost,
            backend.ollamaModel,
            fetchImpl
          )
        );
      } catch (error) {
        console.warn(
          "Ollama reply classification unavailable; using heuristic",
          error
        );
      }
    }

    const heuristic = deps.heuristic ?? classifyReplyEmailHeuristic;
    return withReason(heuristic(emailBody, emailSubject));
  } catch (error) {
    console.error("Sentiment classification error:", error);
    return withReason(failClosedNeutral(error));
  }
}

/**
 * Lightweight helper to detect if an email is likely a reply (vs bounce/OOO).
 * Returns true if email should be processed as a legitimate reply.
 */
export function isProbablyLegitimateReply(
  subject: string,
  body: string
): boolean {
  const subject_lower = subject.toLowerCase();
  const body_lower = body.toLowerCase();

  // Filter out auto-replies
  const autoReplyPatterns = [
    /out of office/i,
    /auto.?reply/i,
    /automatic response/i,
    /away from office/i,
    /i am currently out/i,
  ];

  if (
    autoReplyPatterns.some(
      pattern => subject_lower.match(pattern) || body_lower.match(pattern)
    )
  ) {
    return false;
  }

  // Filter out bounces
  const bouncePatterns = [
    /delivery failed/i,
    /undeliverable/i,
    /mail delivery failed/i,
    /bounce/i,
  ];

  if (
    bouncePatterns.some(
      pattern => subject_lower.match(pattern) || body_lower.match(pattern)
    )
  ) {
    return false;
  }

  // Filter out empty bodies
  if (!body.trim() || body.trim().length < 5) {
    return false;
  }

  return true;
}

/** Nurture cron only auto-sends on positive / objection with a matched lead. */
export function inboundReplyAction(
  sentiment: Sentiment,
  leadId: number | null
): "nurture" | "manual_review" {
  if (!leadId) return "manual_review";
  if (sentiment === "positive" || sentiment === "objection") return "nurture";
  return "manual_review";
}
