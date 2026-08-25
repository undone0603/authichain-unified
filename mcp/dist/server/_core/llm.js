import { ENV } from "./env";
import { getDb } from "../db.js";
import { promptCache } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
const ensureArray = (value) => (Array.isArray(value) ? value : [value]);
const normalizeContentPart = (part) => {
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
const normalizeMessage = (message) => {
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
const normalizeToolChoice = (toolChoice, tools) => {
    if (!toolChoice)
        return undefined;
    if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
    }
    if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
            throw new Error("tool_choice 'required' was provided but no tools were configured");
        }
        if (tools.length > 1) {
            throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
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
const resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";
const assertApiKey = () => {
    if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
    }
};
const normalizeResponseFormat = ({ responseFormat, response_format, outputSchema, output_schema, }) => {
    const explicitFormat = responseFormat || response_format;
    if (explicitFormat) {
        if (explicitFormat.type === "json_schema" &&
            !explicitFormat.json_schema?.schema) {
            throw new Error("responseFormat json_schema requires a defined schema object");
        }
        return explicitFormat;
    }
    const schema = outputSchema || output_schema;
    if (!schema)
        return undefined;
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
export async function invokeLLM(params) {
    assertApiKey();
    const { messages, tools, toolChoice, tool_choice, outputSchema, output_schema, responseFormat, response_format, } = params;
    const payload = {
        model: "gemini-2.5-flash",
        messages: messages.map(normalizeMessage),
    };
    if (tools && tools.length > 0) {
        payload.tools = tools;
    }
    const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
    if (normalizedToolChoice) {
        payload.tool_choice = normalizedToolChoice;
    }
    payload.max_tokens = 32768;
    payload.thinking = {
        "budget_tokens": 128,
    };
    const normalizedResponseFormat = normalizeResponseFormat({
        responseFormat,
        response_format,
        outputSchema,
        output_schema,
    });
    if (normalizedResponseFormat) {
        payload.response_format = normalizedResponseFormat;
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
                return JSON.parse(cached.response);
            }
        }
    }
    catch (err) {
        console.warn("[LLM Cache] Check failed:", err.message);
    }
    const response = await fetch(resolveApiUrl(), {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: payloadStr,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
    }
    const result = (await response.json());
    // Store in cache
    try {
        const db = await getDb();
        if (db) {
            await db.insert(promptCache).values({
                promptHash,
                response: JSON.stringify(result),
                provider: "forge",
                model: payload.model,
                usage: result.usage,
            });
            console.log(`[LLM Cache] Stored for hash: ${promptHash.substring(0, 8)}`);
        }
    }
    catch (err) {
        console.warn("[LLM Cache] Store failed:", err.message);
    }
    return result;
}
/**
 * Parse JSON from an LLM response content field.
 * Accepts the union type returned by LLMResponse.choices[0].message.content.
 * Throws on empty content or invalid JSON.
 */
export function parseLLMContent(raw) {
    if (!raw || typeof raw !== "string")
        throw new Error("LLM returned non-string content");
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error("LLM returned unparseable JSON");
    }
}
