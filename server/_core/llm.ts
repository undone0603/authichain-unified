import { ENV } from "./env";
// invokeLLM() below is imported by 31+ files across the codebase (agents,
// jobs, routers, ...), most not yet migrated off the db.ts singleton. The
// prompt-cache lookup/store here is best-effort and already fail-open (see
// the try/catch around each getDb() call) — rethreading a db param through
// every one of those call sites is well outside this cluster's scope, so
// this stays a documented getDb() bridge instead of a real migration.
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

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// ─── Anthropic Messages API adapter ────────────────────────────────────────
// invokeLLM's public shape (InvokeParams/InvokeResult) is OpenAI-compatible
// because most of the 31+ callers were written against that shape. Anthropic's
// Messages API has a materially different wire format (system is a top-level
// field, not a message role; tool results/calls use different content-block
// shapes; there's no native structured-output response_format), so this
// section converts in both directions rather than changing every caller.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
// Internal marker tool used to force structured JSON output (Anthropic has no
// response_format param; forcing a tool call with the target schema as its
// input_schema is the standard, reliable way to get schema-conformant JSON).
const STRUCTURED_OUTPUT_TOOL = "__structured_output";

type AnthropicImageSource =
  | { type: "base64"; media_type: string; data: string }
  | { type: "url"; url: string };

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: AnthropicImageSource }
  | { type: "document"; source: { type: "url"; url: string } }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: string | AnthropicContentBlock[] };

const DATA_URI_RE = /^data:([^;]+);base64,([\s\S]+)$/;

const imageUrlToSource = (url: string): AnthropicImageSource => {
  const match = url.match(DATA_URI_RE);
  if (match) {
    return { type: "base64", media_type: match[1], data: match[2] };
  }
  return { type: "url", url };
};

// Anthropic's Messages API only has native multimodal support for images and
// PDF documents — no general audio/video file support like OpenAI's API.
// Failing loudly here (rather than silently dropping the content or sending
// something Anthropic will reject) surfaces the gap immediately to the caller.
const SUPPORTED_FILE_MIME_TYPES = new Set(["application/pdf"]);

const partToAnthropicBlock = (part: MessageContent): AnthropicContentBlock => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return { type: "text", text: part.text };
  }
  if (part.type === "image_url") {
    return { type: "image", source: imageUrlToSource(part.image_url.url) };
  }
  if (part.type === "file_url") {
    if (!part.file_url.mime_type || !SUPPORTED_FILE_MIME_TYPES.has(part.file_url.mime_type)) {
      throw new Error(
        `invokeLLM: file_url mime type "${part.file_url.mime_type}" is not supported by the Anthropic gateway (only application/pdf documents are)`
      );
    }
    return { type: "document", source: { type: "url", url: part.file_url.url } };
  }
  throw new Error("Unsupported message content part");
};

const partToText = (part: MessageContent): string => {
  if (typeof part === "string") return part;
  if (part.type === "text") return part.text;
  return "";
};

const toAnthropicMessages = (
  messages: Message[]
): { system?: string; messages: AnthropicMessage[] } => {
  const systemParts: string[] = [];
  const out: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(ensureArray(msg.content).map(partToText).join(""));
      continue;
    }

    if (msg.role === "tool" || msg.role === "function") {
      if (!msg.tool_call_id) {
        throw new Error("invokeLLM: a tool/function-role message requires tool_call_id");
      }
      const text = ensureArray(msg.content)
        .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
        .join("\n");
      const resultBlock: AnthropicContentBlock = { type: "tool_result", tool_use_id: msg.tool_call_id, content: text };

      // Parallel tool calls (Claude's default) each get their own tool-role
      // message from callers like browser-vision.ts, but Anthropic expects
      // all of a turn's tool_results batched into ONE user message —
      // sending them as separate consecutive messages silently discourages
      // the model from using parallel tool calls again. Merge into the
      // previous message when it's also a pure tool_result batch.
      const prev = out[out.length - 1];
      const prevIsToolResultBatch =
        prev?.role === "user" &&
        Array.isArray(prev.content) &&
        prev.content.length > 0 &&
        prev.content.every(b => b.type === "tool_result");
      if (prevIsToolResultBatch) {
        (prev.content as AnthropicContentBlock[]).push(resultBlock);
      } else {
        out.push({ role: "user", content: [resultBlock] });
      }
      continue;
    }

    const toolCalls = (msg as { tool_calls?: ToolCall[] }).tool_calls;
    if (msg.role === "assistant" && toolCalls?.length) {
      const blocks: AnthropicContentBlock[] = [];
      const text = ensureArray(msg.content).map(partToText).join("");
      if (text) blocks.push({ type: "text", text });
      for (const tc of toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
        });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }

    const blocks = ensureArray(msg.content).map(partToAnthropicBlock);
    const role = msg.role === "assistant" ? "assistant" : "user";
    // Collapse a lone text block to a plain string — simpler payloads for the
    // (very common) plain single-text-message case.
    out.push(
      blocks.length === 1 && blocks[0].type === "text"
        ? { role, content: blocks[0].text }
        : { role, content: blocks }
    );
  }

  return { system: systemParts.length ? systemParts.join("\n\n") : undefined, messages: out };
};

const toAnthropicTools = (tools?: Tool[]) => {
  if (!tools || tools.length === 0) return undefined;
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
};

type AnthropicToolChoice = { type: "auto" | "any" | "none" } | { type: "tool"; name: string };

const toAnthropicToolChoice = (
  toolChoice: ToolChoice | undefined,
  tool_choice: ToolChoice | undefined,
  tools: Tool[] | undefined
): AnthropicToolChoice | undefined => {
  const choice = toolChoice || tool_choice;
  if (!choice) return undefined;

  if (choice === "none") return { type: "none" };
  if (choice === "auto") return { type: "auto" };
  if (choice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }
    return { type: "any" };
  }
  if ("name" in choice) return { type: "tool", name: choice.name };
  return { type: "tool", name: choice.function.name };
};

// Only json_schema forces a tool call — its schema gives the model concrete
// top-level keys to fill in, so the forced tool_use.input reliably matches
// the caller's shape. json_object has no schema to anchor it: an empty
// input_schema ({type:"object"}) leaves the model free to invent its own
// top-level key names, and it does — observed wrapping real output in
// {"output":{...}} or {"data":{...}} inconsistently across calls, so
// callers destructuring the promised top-level fields silently got
// undefined. json_object is handled as plain-text JSON instead (see
// JSON_OBJECT_INSTRUCTION below), matching how callers' prompts already
// describe the desired shape in words.
const structuredOutputTool = (
  format: ReturnType<typeof normalizeResponseFormat>
): { name: string; description: string; input_schema: Record<string, unknown>; strict?: boolean } | undefined => {
  if (!format || format.type !== "json_schema") return undefined;
  return {
    name: STRUCTURED_OUTPUT_TOOL,
    description: "Return the requested structured output.",
    input_schema: format.json_schema.schema,
    ...(format.json_schema.strict ? { strict: true } : {}),
  };
};

const JSON_OBJECT_INSTRUCTION =
  "Respond with ONLY a single valid JSON object matching the shape described above — no markdown code fences, no explanation, no wrapper key around it.";

// Strips a ```json ... ``` (or bare ```...```) fence if the model wrapped
// its JSON in one despite JSON_OBJECT_INSTRUCTION — a defensive fallback,
// not the primary mechanism.
const stripJsonFence = (text: string): string => {
  const match = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return match ? match[1] : text;
};

const FINISH_REASON_MAP: Record<string, string> = {
  end_turn: "stop",
  stop_sequence: "stop",
  max_tokens: "length",
  tool_use: "tool_calls",
};

type AnthropicResponse = {
  id: string;
  model: string;
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  stop_reason: string;
  usage?: { input_tokens: number; output_tokens: number };
};

const fromAnthropicResponse = (
  anthropicResult: AnthropicResponse,
  isStructuredOutput: boolean,
  isJsonTextMode: boolean
): InvokeResult => {
  const textBlocks = anthropicResult.content.filter(
    (b): b is { type: "text"; text: string } => b.type === "text"
  );
  const toolUseBlocks = anthropicResult.content.filter(
    (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
      b.type === "tool_use"
  );

  let content: string = textBlocks.map(b => b.text).join("");
  let toolCalls: ToolCall[] | undefined;

  if (isStructuredOutput) {
    const structuredBlock = toolUseBlocks.find(b => b.name === STRUCTURED_OUTPUT_TOOL);
    if (structuredBlock) content = JSON.stringify(structuredBlock.input);
  } else if (isJsonTextMode) {
    content = stripJsonFence(content);
  } else if (toolUseBlocks.length > 0) {
    toolCalls = toolUseBlocks.map(b => ({
      id: b.id,
      type: "function" as const,
      function: { name: b.name, arguments: JSON.stringify(b.input) },
    }));
  }

  return {
    id: anthropicResult.id,
    created: Math.floor(Date.now() / 1000),
    model: anthropicResult.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
        finish_reason: FINISH_REASON_MAP[anthropicResult.stop_reason] ?? anthropicResult.stop_reason ?? null,
      },
    ],
    usage: anthropicResult.usage
      ? {
          prompt_tokens: anthropicResult.usage.input_tokens,
          completion_tokens: anthropicResult.usage.output_tokens,
          total_tokens: anthropicResult.usage.input_tokens + anthropicResult.usage.output_tokens,
        }
      : undefined,
  };
};

const assertApiKey = () => {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
};

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

  const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  const structuredTool = structuredOutputTool(normalizedResponseFormat);
  const isStructuredOutput = !!structuredTool;
  const isJsonTextMode = normalizedResponseFormat?.type === "json_object";

  const payload: Record<string, unknown> = {
    model: ENV.anthropicModel || DEFAULT_MODEL,
    max_tokens: maxTokens || max_tokens || 8192,
    messages: anthropicMessages,
  };
  if (isJsonTextMode) {
    payload.system = system ? `${system}\n\n${JSON_OBJECT_INSTRUCTION}` : JSON_OBJECT_INSTRUCTION;
  } else if (system) {
    payload.system = system;
  }

  if (isStructuredOutput) {
    payload.tools = [structuredTool];
    payload.tool_choice = { type: "tool", name: STRUCTURED_OUTPUT_TOOL };
  } else {
    const anthropicTools = toAnthropicTools(tools);
    if (anthropicTools) payload.tools = anthropicTools;

    const anthropicToolChoice = toAnthropicToolChoice(toolChoice, tool_choice, tools);
    if (anthropicToolChoice) payload.tool_choice = anthropicToolChoice;
  }

  // ─── Prompt Caching ────────────────────────────────────────────────────────
  const payloadStr = JSON.stringify(payload);
  const promptHash = createHash("sha256").update(payloadStr).digest("hex");

  try {
    const db = await getDb();
    if (db) {
      const [cached] = await db.select().from(promptCache).where(eq(promptCache.promptHash, promptHash)).limit(1);
      if (cached) {
        console.log(`[LLM Cache] Hit for hash: ${promptHash.substring(0, 8)}`);
        return JSON.parse(cached.response) as InvokeResult;
      }
    }
  } catch (err: any) {
    console.warn("[LLM Cache] Check failed:", err.message);
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
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const anthropicResult = (await response.json()) as AnthropicResponse;
  const result = fromAnthropicResponse(anthropicResult, isStructuredOutput, isJsonTextMode);

  // Store in cache
  try {
    const db = await getDb();
    if (db) {
      await db.insert(promptCache).values({
        promptHash,
        response: JSON.stringify(result),
        provider: "anthropic",
        model: payload.model as string,
        usage: result.usage,
      });
      console.log(`[LLM Cache] Stored for hash: ${promptHash.substring(0, 8)}`);
    }
  } catch (err: any) {
    console.warn("[LLM Cache] Store failed:", err.message);
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
