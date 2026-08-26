import { ENV } from "./env";
import { getDb } from "../db.js";
import { promptCache } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 4096;
const JSON_ONLY_INSTRUCTION =
  "Respond with only a valid JSON object. Do not include markdown code fences or any prose outside the JSON.";

const assertApiKey = () => {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
};

// ─── Gemini fallback ────────────────────────────────────────────────────────
//
// Anthropic is the primary provider. This exists because it can become
// unavailable for reasons that have nothing to do with the request: on
// 2026-08-21 every DRAFT_LAUNCH_EMAIL task in the queue failed with
//
//   400 – "Your credit balance is too low to access the Anthropic API"
//
// which stalled the whole pipeline behind a billing action. Gemini has a
// no-cost tier and GEMINI_API_KEY is already supplied to the jobs that need
// this, so the work can continue at zero spend instead of stopping.
//
// It is a fallback, not a peer. Anthropic is tried first every time and the
// switch only happens on failures that mean "we cannot reach Anthropic",
// never on a 400 that means "this request is malformed" — falling back on a
// genuine bug would hide it behind a second provider that happens to be more
// forgiving.
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Whether an Anthropic failure means the provider is unavailable to us, as
 * opposed to the request being wrong.
 *
 * Deliberately narrow. Auth, quota, billing and server faults are all "try
 * someone else"; a plain 400 is "fix the caller" and must keep surfacing.
 */
export function shouldFallBackFromAnthropic(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ANTHROPIC_API_KEY is not configured")) return true;
  // Billing exhaustion arrives as a 400, so it is matched on content rather
  // than status — this is the case that prompted the fallback.
  if (/credit balance is too low|billing|quota|insufficient_quota/i.test(message)) return true;

  const status = message.match(/Anthropic API error: (\d{3})/)?.[1];
  if (!status) return false;
  return ["401", "402", "403", "408", "429", "500", "502", "503", "504"].includes(status);
}

/** Maps the shared message list onto Gemini's `contents` + `systemInstruction`. */
function convertMessagesToGemini(messages: Message[]) {
  const systemParts: string[] = [];
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Only text survives the conversion. Image and file parts are dropped rather
  // than guessed at, since Gemini's inlineData shape is not a rename of
  // Anthropic's — the fallback exists to keep text generation working, and a
  // half-translated multimodal request would fail in a more confusing way.
  const flatten = (content: Message["content"]): string => {
    if (typeof content === "string") return content;
    const parts: MessageContent[] = Array.isArray(content) ? content : [content];
    return parts
      .map(part => (typeof part === "string" ? part : part.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  };

  for (const message of messages) {
    const text = flatten(message.content);
    if (!text) continue;
    if (message.role === "system") {
      systemParts.push(text);
      continue;
    }
    // Gemini names the assistant "model" and accepts no other roles here.
    contents.push({ role: message.role === "assistant" ? "model" : "user", parts: [{ text }] });
  }

  return { system: systemParts.join("\n") || undefined, contents };
}

async function invokeGemini(args: {
  messages: Message[];
  maxTokens: number;
  jsonSchema?: JsonSchema;
  jsonObject: boolean;
}): Promise<InvokeResult> {
  const { system, contents } = convertMessagesToGemini(args.messages);

  const generationConfig: Record<string, unknown> = { maxOutputTokens: args.maxTokens };
  if (args.jsonSchema) {
    // Gemini enforces a schema natively, so structured output survives the
    // fallback rather than degrading to "JSON-ish prose".
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = args.jsonSchema.schema;
  } else if (args.jsonObject) {
    generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/${ENV.geminiModel}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} – ${await response.text()}`);
  }

  const raw: any = await response.json();
  const candidate = raw.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: any) => p.text ?? "")
    .join("");

  return {
    id: raw.responseId ?? "gemini",
    created: Math.floor(Date.now() / 1000),
    model: raw.modelVersion ?? ENV.geminiModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: candidate?.finishReason === "STOP" ? "stop" : (candidate?.finishReason ?? null),
      },
    ],
    usage: raw.usageMetadata
      ? {
          prompt_tokens: raw.usageMetadata.promptTokenCount ?? 0,
          completion_tokens: raw.usageMetadata.candidatesTokenCount ?? 0,
          total_tokens: raw.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

// ─── Content conversion helpers ────────────────────────────────────────────

function convertContentPartToAnthropic(part: MessageContent): unknown {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return { type: "text", text: part.text };
  }
  if (part.type === "image_url") {
    const url = part.image_url.url;
    if (url.startsWith("data:")) {
      const [meta, data] = url.split(",");
      const mediaType = meta.replace("data:", "").replace(";base64", "");
      return { type: "image", source: { type: "base64", media_type: mediaType, data } };
    }
    return { type: "image", source: { type: "url", url } };
  }
  if (part.type === "file_url") {
    const mime = part.file_url.mime_type ?? "";
    throw new Error(
      `Unsupported file_url mime type for Anthropic: ${mime}. Only image types are supported.`
    );
  }
  throw new Error("Unsupported message content part");
}

function contentToAnthropic(content: MessageContent | MessageContent[]): unknown {
  const parts = Array.isArray(content) ? content : [content];
  const converted = parts.map(convertContentPartToAnthropic);
  // Collapse to a plain string when there is only one text block (Anthropic accepts both)
  if (converted.length === 1 && (converted[0] as any).type === "text") {
    return (converted[0] as any).text;
  }
  return converted;
}

// ─── Message conversion (OpenAI → Anthropic) ───────────────────────────────

function convertMessagesToAnthropic(messages: Message[]): {
  system: string | undefined;
  anthropicMessages: unknown[];
} {
  // Extract system messages into top-level system field
  const systemParts: string[] = [];
  const rest: Message[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
    } else {
      rest.push(msg);
    }
  }
  const system = systemParts.length > 0 ? systemParts.join("\n") : undefined;

  // Convert remaining messages, merging consecutive tool results
  const anthropicMessages: unknown[] = [];
  let i = 0;
  while (i < rest.length) {
    const msg = rest[i];

    if (msg.role === "tool" || msg.role === "function") {
      if (!msg.tool_call_id) {
        throw new Error("tool-role message is missing tool_call_id");
      }
      // Collect all consecutive tool messages
      const toolResults: unknown[] = [];
      while (
        i < rest.length &&
        (rest[i].role === "tool" || rest[i].role === "function")
      ) {
        const t = rest[i];
        if (!t.tool_call_id) throw new Error("tool-role message is missing tool_call_id");
        toolResults.push({
          type: "tool_result",
          tool_use_id: t.tool_call_id,
          content: typeof t.content === "string" ? t.content : JSON.stringify(t.content),
        });
        i++;
      }
      anthropicMessages.push({ role: "user", content: toolResults });
      continue;
    }

    if (msg.role === "assistant") {
      const toolCallsField = (msg as any).tool_calls as ToolCall[] | undefined;
      if (toolCallsField && toolCallsField.length > 0) {
        const content: unknown[] = [];
        if (msg.content && msg.content !== "") {
          content.push({ type: "text", text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) });
        }
        for (const tc of toolCallsField) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        anthropicMessages.push({ role: "assistant", content });
      } else {
        anthropicMessages.push({
          role: "assistant",
          content: contentToAnthropic(msg.content),
        });
      }
      i++;
      continue;
    }

    // user message
    anthropicMessages.push({
      role: "user",
      content: contentToAnthropic(msg.content),
    });
    i++;
  }

  return { system, anthropicMessages };
}

// ─── Tool conversion (OpenAI → Anthropic) ──────────────────────────────────

function convertToolsToAnthropic(tools: Tool[], strict?: boolean): unknown[] {
  return tools.map(t => ({
    name: t.function.name,
    ...(t.function.description ? { description: t.function.description } : {}),
    input_schema: t.function.parameters ?? { type: "object" },
    ...(strict === true ? { strict: true } : {}),
  }));
}

function convertToolChoiceToAnthropic(
  choice: ToolChoice | undefined
): unknown | undefined {
  if (!choice) return undefined;
  if (choice === "none") return { type: "none" };
  if (choice === "auto") return { type: "auto" };
  if (choice === "required") return { type: "any" };
  if ("name" in choice) return { type: "tool", name: (choice as ToolChoiceByName).name };
  if ("type" in choice && (choice as ToolChoiceExplicit).type === "function") {
    return { type: "tool", name: (choice as ToolChoiceExplicit).function.name };
  }
  return undefined;
}

// ─── Response conversion (Anthropic → OpenAI) ──────────────────────────────

function mapFinishReason(stopReason: string | null): string | null {
  if (stopReason === "end_turn") return "stop";
  if (stopReason === "tool_use") return "tool_calls";
  if (stopReason === "max_tokens") return "length";
  return stopReason;
}

function convertAnthropicResponse(
  raw: any,
  structuredOutputMode: boolean
): InvokeResult {
  const toolCalls: ToolCall[] = [];
  let textContent = "";
  let structuredOutputContent: string | undefined;

  for (const block of raw.content ?? []) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      if (block.name === "__structured_output" && structuredOutputMode) {
        structuredOutputContent = JSON.stringify(block.input);
      } else {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: { name: block.name, arguments: JSON.stringify(block.input) },
        });
      }
    }
  }

  const messageContent = structuredOutputContent ?? textContent;

  return {
    id: raw.id ?? "anthropic",
    created: Math.floor(Date.now() / 1000),
    model: raw.model ?? DEFAULT_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: messageContent,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: mapFinishReason(raw.stop_reason ?? null),
      },
    ],
    usage: raw.usage
      ? {
          prompt_tokens: raw.usage.input_tokens,
          completion_tokens: raw.usage.output_tokens,
          total_tokens: raw.usage.input_tokens + raw.usage.output_tokens,
        }
      : undefined,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    maxTokens,
    max_tokens,
  } = params;

  // Resolve response format
  const explicitFormat = responseFormat || response_format;
  const schema = outputSchema || output_schema;
  const resolvedFormat: ResponseFormat | undefined = explicitFormat ?? (
    schema ? { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema, ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}) } } : undefined
  );

  const isStructuredOutput = resolvedFormat?.type === "json_schema";
  const isJsonObject = resolvedFormat?.type === "json_object";

  // Convert messages
  const convertedMessages = convertMessagesToAnthropic(messages);
  let { system } = convertedMessages;
  const { anthropicMessages } = convertedMessages;

  // JSON object mode: append system instruction
  if (isJsonObject) {
    system = system ? `${system}\n${JSON_ONLY_INSTRUCTION}` : JSON_ONLY_INSTRUCTION;
  }

  // Build tools list
  let anthropicTools: unknown[] | undefined;
  let anthropicToolChoice: unknown | undefined;

  if (isStructuredOutput && resolvedFormat.type === "json_schema") {
    const js = resolvedFormat.json_schema;
    anthropicTools = [
      {
        name: "__structured_output",
        description: "Return structured JSON matching the provided schema.",
        input_schema: js.schema,
        ...(js.strict === true ? { strict: true } : {}),
      },
    ];
    anthropicToolChoice = { type: "tool", name: "__structured_output" };
  } else if (tools && tools.length > 0) {
    anthropicTools = convertToolsToAnthropic(tools);
    anthropicToolChoice = convertToolChoiceToAnthropic(toolChoice ?? tool_choice);
  }

  const payload: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    max_tokens: maxTokens ?? max_tokens ?? DEFAULT_MAX_TOKENS,
    messages: anthropicMessages,
  };

  if (system !== undefined) payload.system = system;
  if (anthropicTools) payload.tools = anthropicTools;
  if (anthropicToolChoice) payload.tool_choice = anthropicToolChoice;

  // ─── Prompt Caching ──────────────────────────────────────────────────────
  const payloadStr = JSON.stringify(payload);
  const promptHash = createHash("sha256").update(payloadStr).digest("hex");

  try {
    const db = await getDb();
    if (db) {
      const [cached] = await db.select().from(promptCache).where(eq(promptCache.promptHash, promptHash)).limit(1);
      if (cached) {
        return JSON.parse(cached.response) as InvokeResult;
      }
    }
  } catch {
    // Cache check is best-effort; proceed without it
  }

  // A caller-supplied tool list is Anthropic-only. Structured output is not:
  // it is expressed here as an internal tool, but Gemini enforces the same
  // schema natively, so it survives the fallback. Falling back with real tools
  // would silently drop the model's ability to call them, which is worse than
  // failing.
  const wantsCallerTools = !!(tools && tools.length > 0) && !isStructuredOutput;

  let result: InvokeResult;
  let provider = "anthropic";
  let model = DEFAULT_MODEL;

  try {
    assertApiKey();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ENV.anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: payloadStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} – ${errorText}`);
    }

    const raw = await response.json();

    // For json_object mode, strip markdown fences if the model wraps the JSON
    if (isJsonObject && raw.content?.[0]?.type === "text") {
      const stripped = raw.content[0].text
        .trim()
        .replace(/^\s*```(?:json)?\s*\n?/, "")
        .replace(/\n?\s*```\s*$/, "")
        .trim();
      raw.content[0].text = stripped;
    }

    result = convertAnthropicResponse(raw, isStructuredOutput);
  } catch (anthropicError) {
    if (!ENV.geminiApiKey || wantsCallerTools || !shouldFallBackFromAnthropic(anthropicError)) {
      throw anthropicError;
    }

    // Say so rather than silently switching providers: a caller comparing
    // outputs across runs needs to know the model changed underneath them.
    const reason = anthropicError instanceof Error ? anthropicError.message : String(anthropicError);
    console.warn(`[llm] Anthropic unavailable, falling back to ${ENV.geminiModel}: ${reason.slice(0, 200)}`);

    result = await invokeGemini({
      messages,
      maxTokens: maxTokens ?? max_tokens ?? DEFAULT_MAX_TOKENS,
      jsonSchema: isStructuredOutput && resolvedFormat.type === "json_schema" ? resolvedFormat.json_schema : undefined,
      jsonObject: isJsonObject,
    });
    provider = "gemini";
    model = ENV.geminiModel;
  }

  // Store in cache (best-effort)
  try {
    const db = await getDb();
    if (db) {
      await db.insert(promptCache).values({
        promptHash,
        response: JSON.stringify(result),
        // The actual provider, not an assumed one — the cache is also the
        // record of which model produced a given output.
        provider,
        model,
        usage: result.usage,
      });
    }
  } catch {
    // Cache store is best-effort
  }

  return result;
}

/**
 * Parse JSON from an LLM response content field.
 * Accepts the union type returned by LLMResponse.choices[0].message.content.
 * Throws on empty content or invalid JSON.
 */
export function parseLLMContent<T>(raw: string | unknown[] | null | undefined): T {
  if (!raw || typeof raw !== "string") throw new Error("LLM returned non-string content");
  try { return JSON.parse(raw) as T; }
  catch { throw new Error("LLM returned unparseable JSON"); }
}
