import { ENV } from "./env";

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

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () => {
  const base = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? ENV.forgeApiUrl.replace(/\/$/, "")
    : "https://forge.manus.im";
  
  return `${base}/v1/chat/completions`;
};

const assertApiKey = () => {
  if (!ENV.forgeApiKey && !ENV.openaiApiKey) {
    throw new Error("Neither BUILT_IN_FORGE_API_KEY nor OPENAI_API_KEY is configured");
  }
};

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
  } = params;

  // ─── Cascading Execution Logic ───────────────────────────────────────────
  const endpoints = [
    { url: resolveApiUrl(), key: ENV.forgeApiKey, name: "Forge", model: "gpt-4o" },
    { url: "https://api.openai.com/v1/chat/completions", key: ENV.openaiApiKey, name: "OpenAI", model: "gpt-4o" },
    { url: "https://api.groq.com/openai/v1/chat/completions", key: ENV.groqApiKey, name: "Groq", model: "llama-3.1-8b-instant" },
    { url: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, key: ENV.geminiApiKey, name: "Gemini", model: "gemini-1.5-flash" }
  ].filter(e => e.key); // Only use endpoints where we have keys

  if (endpoints.length === 0) {
    throw new Error("No LLM API keys configured (Neither Forge, OpenAI, Groq, nor Gemini)");
  }

  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    console.log(`[LLM] Attempting invoke via ${endpoint.name} (${endpoint.model})...`);
    
    // Throttle Groq to avoid 429s
    if (endpoint.name === "Groq") {
      await new Promise(r => setTimeout(r, 2000));
    }

    const payload: Record<string, unknown> = {
      model: endpoint.model,
      messages: messages.map(normalizeMessage),
      max_tokens: endpoint.name === "Gemini" ? 8192 : 4096,
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "authorization": `Bearer ${endpoint.key}`,
    };
    
    // Retry up to 2 times for each endpoint
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          // Set a 30s timeout
          signal: AbortSignal.timeout(30000)
        });

        if (response.ok) {
          return (await response.json()) as InvokeResult;
        }

        const errorText = await response.text();
        const status = response.status;
        
        // If it's a client error (4xx) other than 429, don't retry this endpoint
        if (status >= 400 && status < 500 && status !== 429) {
          console.warn(`[LLM] ${endpoint.name} Client Error ${status}: ${errorText}`);
          throw new Error(`[${endpoint.name} Client Error] ${status}: ${errorText}`);
        }
        
        console.warn(`[LLM] ${endpoint.name} attempt ${attempt} failed with ${status}.`);
        lastError = new Error(`${endpoint.name} ${status}: ${errorText}`);
        
        // Exponential backoff before retry (500ms, 1000ms)
        await new Promise(r => setTimeout(r, attempt * 500));
        
      } catch (err: any) {
        console.warn(`[LLM] ${endpoint.name} attempt ${attempt} exception: ${err.message}`);
        lastError = err;
        if (attempt === 2) break; // Move to next endpoint
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }

  throw new Error(`All LLM endpoints failed. Last error: ${lastError?.message}`);
}
