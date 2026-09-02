import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./env", () => ({ ENV: { anthropicApiKey: "test-key" } }));

// Prompt-cache DB lookups are best-effort/fail-open; stub getDb to reject so
// every test exercises the real API-call path deterministically.
vi.mock("../db.js", () => ({
  getDb: vi.fn(async () => {
    throw new Error("no db in tests");
  }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function anthropicResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      id: "msg_123",
      model: "claude-haiku-4-5-20251001",
      content: [{ type: "text", text: "hello" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
      ...overrides,
    }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
});

// Imported after mocks so the module picks up the mocked ENV/getDb.
const { invokeLLM, parseLLMContent } = await import("./llm");

describe("invokeLLM request shape", () => {
  it("calls the Anthropic Messages API with the API key header", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key");
    expect(init.headers["anthropic-version"]).toBeTruthy();
  });

  it("extracts system-role messages into the top-level system field", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "hi" },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe("You are helpful.");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("throws before calling fetch when the API key is missing", async () => {
    vi.doMock("./env", () => ({ ENV: { anthropicApiKey: "" } }));
    vi.resetModules();
    const { invokeLLM: invokeLLMNoKey } = await import("./llm");
    await expect(
      invokeLLMNoKey({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.doUnmock("./env");
  });
});

describe("response conversion to OpenAI-compatible shape", () => {
  it("maps a plain text response into choices[0].message.content", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({ content: [{ type: "text", text: "the answer" }] })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.choices[0].message.content).toBe("the answer");
    expect(result.choices[0].message.role).toBe("assistant");
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
    });
  });

  it("maps stop_reason tool_use to finish_reason tool_calls", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "navigate",
            input: { url: "https://x.com" },
          },
        ],
      })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
      tools: [
        { type: "function", function: { name: "navigate", parameters: {} } },
      ],
    });

    expect(result.choices[0].finish_reason).toBe("tool_calls");
    expect(result.choices[0].message.tool_calls).toEqual([
      {
        id: "toolu_1",
        type: "function",
        function: {
          name: "navigate",
          arguments: JSON.stringify({ url: "https://x.com" }),
        },
      },
    ]);
  });

  it("maps stop_reason max_tokens to finish_reason length", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({ stop_reason: "max_tokens" })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.choices[0].finish_reason).toBe("length");
  });
});

describe("tool round-tripping (agentic loop, e.g. browser-vision.ts)", () => {
  it("converts an assistant message carrying tool_calls into tool_use content blocks", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        { role: "user", content: "go" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "toolu_1",
              type: "function",
              function: {
                name: "navigate",
                arguments: '{"url":"https://x.com"}',
              },
            },
          ],
        },
        {
          role: "tool",
          content: "ok",
          tool_call_id: "toolu_1",
          name: "navigate",
        },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1]).toEqual({
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "navigate",
          input: { url: "https://x.com" },
        },
      ],
    });
    expect(body.messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }],
    });
  });

  it("converts caller-supplied OpenAI-shaped tools into Anthropic tool definitions", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          type: "function",
          function: {
            name: "navigate",
            description: "go somewhere",
            parameters: { type: "object" },
          },
        },
      ],
      toolChoice: "required",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      {
        name: "navigate",
        description: "go somewhere",
        input_schema: { type: "object" },
      },
    ]);
    expect(body.tool_choice).toEqual({ type: "any" });
  });

  it("batches parallel tool results into one user message instead of separate consecutive ones", async () => {
    // Claude's default is to emit multiple tool_use blocks in a single turn.
    // A caller looping over each call typically pushes one tool-role message
    // per result (as browser-vision.ts does) -- those must be merged back
    // into ONE user message with N tool_result blocks, or the model is
    // silently discouraged from making parallel tool calls again.
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        { role: "user", content: "go" },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "toolu_1",
              type: "function",
              function: { name: "navigate", arguments: "{}" },
            },
            {
              id: "toolu_2",
              type: "function",
              function: { name: "extract", arguments: "{}" },
            },
          ],
        },
        {
          role: "tool",
          content: "ok-1",
          tool_call_id: "toolu_1",
          name: "navigate",
        },
        {
          role: "tool",
          content: "ok-2",
          tool_call_id: "toolu_2",
          name: "extract",
        },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(3); // user, assistant, ONE merged user (not 2 separate)
    expect(body.messages[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "toolu_1", content: "ok-1" },
        { type: "tool_result", tool_use_id: "toolu_2", content: "ok-2" },
      ],
    });
  });

  it("throws when a tool-role message has no tool_call_id, instead of sending an opaque empty id", async () => {
    await expect(
      invokeLLM({
        messages: [{ role: "tool", content: "ok" }],
      })
    ).rejects.toThrow(/tool_call_id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("image content conversion", () => {
  it("converts a data: URI image into an Anthropic base64 source", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "what is this" },
            {
              type: "image_url",
              image_url: { url: "data:image/jpeg;base64,ABCD1234" },
            },
          ],
        },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: "text", text: "what is this" },
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "ABCD1234" },
      },
    ]);
  });

  it("converts a plain http(s) image URL into an Anthropic url source", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "https://x.com/a.png" } },
          ],
        },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: "image", source: { type: "url", url: "https://x.com/a.png" } },
    ]);
  });

  it("rejects unsupported file_url mime types loudly instead of mishandling them", async () => {
    await expect(
      invokeLLM({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "file_url",
                file_url: {
                  url: "https://x.com/a.mp3",
                  mime_type: "audio/mpeg",
                },
              },
            ],
          },
        ],
      })
    ).rejects.toThrow(/audio\/mpeg/);
  });
});

describe("structured JSON output via forced tool-use", () => {
  it("forces a tool call for responseFormat json_schema and returns its input as content", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "__structured_output",
            input: { title: "T", body: "B" },
          },
        ],
      })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "write something" }],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "page",
          schema: {
            type: "object",
            properties: { title: { type: "string" }, body: { type: "string" } },
          },
        },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      {
        name: "__structured_output",
        description: expect.any(String),
        input_schema: {
          type: "object",
          properties: { title: { type: "string" }, body: { type: "string" } },
        },
      },
    ]);
    expect(body.tool_choice).toEqual({
      type: "tool",
      name: "__structured_output",
    });

    expect(result.choices[0].message.content).toBe(
      JSON.stringify({ title: "T", body: "B" })
    );
    expect(result.choices[0].message.tool_calls).toBeUndefined();
    expect(() =>
      parseLLMContent(result.choices[0].message.content)
    ).not.toThrow();
  });

  it("json_object does NOT force a tool (an empty schema lets the model invent wrapper keys)", async () => {
    // Regression test: forcing a tool with input_schema:{type:'object'} (no
    // required properties) let the model wrap real output in an arbitrary
    // key ({"output":{...}}, {"data":{...}}) inconsistently across calls,
    // so callers destructuring the promised top-level fields silently got
    // undefined. json_object must stay plain-text so the caller's own
    // prompt (which already describes the shape in words) is what the
    // model follows, not an unconstrained schema.
    fetchMock.mockResolvedValue(
      anthropicResponse({
        content: [{ type: "text", text: '{"anything":"goes"}' }],
      })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "give me json" }],
      responseFormat: { type: "json_object" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(result.choices[0].message.content).toBe('{"anything":"goes"}');
    // No caller system message here (generateSeoPage's real-world case) --
    // the instruction must still be set as the entire system field, not
    // silently dropped by the "join with existing system" branch.
    expect(body.system).toMatch(/only.*valid json object/i);
  });

  it("json_object appends a JSON-only instruction to the system prompt", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({ content: [{ type: "text", text: "{}" }] })
    );
    await invokeLLM({
      messages: [
        { role: "system", content: "You write SEO copy." },
        { role: "user", content: "give me json" },
      ],
      responseFormat: { type: "json_object" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toContain("You write SEO copy.");
    expect(body.system).toMatch(/only.*valid json object/i);
  });

  it("json_object strips a markdown code fence if the model wraps one anyway", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({
        content: [{ type: "text", text: '```json\n{"anything":"goes"}\n```' }],
      })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "give me json" }],
      responseFormat: { type: "json_object" },
    });

    expect(result.choices[0].message.content).toBe('{"anything":"goes"}');
    expect(() =>
      parseLLMContent(result.choices[0].message.content)
    ).not.toThrow();
  });

  it("json_object strips a fence even with a leading newline or surrounding whitespace", async () => {
    // Regression: the fence regex used to anchor directly to ``` with no
    // allowance for leading whitespace, so a model response starting with a
    // stray newline before the fence (observed in practice) silently failed
    // to strip, leaving unparseable text.
    fetchMock.mockResolvedValue(
      anthropicResponse({
        content: [
          { type: "text", text: '\n  ```json\n{"anything":"goes"}\n```  \n' },
        ],
      })
    );
    const result = await invokeLLM({
      messages: [{ role: "user", content: "give me json" }],
      responseFormat: { type: "json_object" },
    });

    expect(result.choices[0].message.content).toBe('{"anything":"goes"}');
    expect(() =>
      parseLLMContent(result.choices[0].message.content)
    ).not.toThrow();
  });

  it("does not force a tool for plain text (no responseFormat)", async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it("passes strict:true through to the Anthropic tool definition when requested", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "__structured_output",
            input: { title: "T" },
          },
        ],
      })
    );
    await invokeLLM({
      messages: [{ role: "user", content: "write something" }],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "page",
          schema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools[0].strict).toBe(true);
  });

  it("omits strict when not requested", async () => {
    fetchMock.mockResolvedValue(
      anthropicResponse({
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "__structured_output",
            input: { title: "T" },
          },
        ],
      })
    );
    await invokeLLM({
      messages: [{ role: "user", content: "write something" }],
      responseFormat: {
        type: "json_schema",
        json_schema: { name: "page", schema: { type: "object" } },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools[0].strict).toBeUndefined();
  });
});

describe("error handling", () => {
  it("throws with status and body text on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "bad key",
    });
    await expect(
      invokeLLM({ messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow(/401.*bad key/s);
  });
});

describe("parseLLMContent", () => {
  it("parses valid JSON content", () => {
    expect(parseLLMContent<{ a: number }>(JSON.stringify({ a: 1 }))).toEqual({
      a: 1,
    });
  });

  it("throws on non-string content", () => {
    expect(() => parseLLMContent(undefined)).toThrow();
  });
});
