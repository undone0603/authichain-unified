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
  assertApiKey();

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

  const result = convertAnthropicResponse(raw, isStructuredOutput);

  // Store in cache (best-effort)
  try {
    const db = await getDb();
    if (db) {
      await db.insert(promptCache).values({
        promptHash,
        response: JSON.stringify(result),
        provider: "anthropic",
        model: DEFAULT_MODEL,
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
