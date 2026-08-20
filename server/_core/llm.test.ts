import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  forgeApiKey: 'test-key',
  forgeApiUrl: 'https://fake.api/',
}));

vi.mock('./env', () => ({ ENV: mockEnv }));
vi.mock('../db.js', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const defaultResult = {
  id: 'chatcmpl_123',
  created: 1720000000,
  model: 'gemini-2.5-flash',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'hello',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
};

function forgeResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      ...defaultResult,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  mockEnv.forgeApiKey = 'test-key';
  mockEnv.forgeApiUrl = 'https://fake.api/';
});

const { invokeLLM, parseLLMContent } = await import('./llm');

describe('invokeLLM request shape', () => {
  it('posts OpenAI-compatible requests to the Forge chat completions endpoint', async () => {
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://fake.api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers.authorization).toContain('test-key');

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 32768,
      thinking: { budget_tokens: 128 },
    });
  });

  it('falls back to the default Forge endpoint when forgeApiUrl is blank', async () => {
    mockEnv.forgeApiUrl = '';
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });

    expect(fetchMock.mock.calls[0][0]).toBe('https://forge.manus.im/v1/chat/completions');
  });

  it('normalizes text, image, file, and tool messages without Anthropic-specific conversion', async () => {
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({
      messages: [
        { role: 'system', content: [{ type: 'text', text: 'Follow policy.' }] },
        {
          role: 'user',
          content: [
            'Describe this asset',
            { type: 'image_url', image_url: { url: 'https://cdn.example.com/item.png', detail: 'high' } },
            { type: 'file_url', file_url: { url: 'https://cdn.example.com/spec.pdf', mime_type: 'application/pdf' } },
          ],
        },
        {
          role: 'tool',
          name: 'lookup',
          tool_call_id: 'call_1',
          content: ['ok', { type: 'text', text: 'done' }],
        },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'Follow policy.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this asset' },
          { type: 'image_url', image_url: { url: 'https://cdn.example.com/item.png', detail: 'high' } },
          { type: 'file_url', file_url: { url: 'https://cdn.example.com/spec.pdf', mime_type: 'application/pdf' } },
        ],
      },
      {
        role: 'tool',
        name: 'lookup',
        tool_call_id: 'call_1',
        content: 'ok\n{"type":"text","text":"done"}',
      },
    ]);
  });
});

describe('tools and tool choice', () => {
  it('passes tools through and expands required to the single configured function', async () => {
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        {
          type: 'function',
          function: {
            name: 'lookup',
            description: 'Find a record',
            parameters: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      ],
      toolChoice: 'required',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'lookup',
          description: 'Find a record',
          parameters: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    ]);
    expect(body.tool_choice).toEqual({
      type: 'function',
      function: { name: 'lookup' },
    });
  });

  it('converts a name-only tool choice alias to the explicit Forge/OpenAI function form', async () => {
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'lookup' } }],
      tool_choice: { name: 'lookup' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tool_choice).toEqual({
      type: 'function',
      function: { name: 'lookup' },
    });
  });

  it('throws for invalid required tool choice configurations before fetch', async () => {
    await expect(
      invokeLLM({
        messages: [{ role: 'user', content: 'hi' }],
        toolChoice: 'required',
      })
    ).rejects.toThrow(/no tools were configured/i);

    await expect(
      invokeLLM({
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          { type: 'function', function: { name: 'lookup' } },
          { type: 'function', function: { name: 'search' } },
        ],
        toolChoice: 'required',
      })
    ).rejects.toThrow(/needs a single tool/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('response formats', () => {
  it('passes through an explicit responseFormat unchanged', async () => {
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({
      messages: [{ role: 'user', content: 'return json' }],
      responseFormat: { type: 'json_object' },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('maps outputSchema to response_format json_schema and preserves strict', async () => {
    fetchMock.mockResolvedValue(forgeResponse());

    await invokeLLM({
      messages: [{ role: 'user', content: 'return json' }],
      output_schema: {
        name: 'page',
        schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
          additionalProperties: false,
        },
        strict: true,
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'page',
        schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
          additionalProperties: false,
        },
        strict: true,
      },
    });
  });

  it('rejects invalid response format schema inputs before fetch', async () => {
    await expect(
      invokeLLM({
        messages: [{ role: 'user', content: 'return json' }],
        responseFormat: { type: 'json_schema', json_schema: { name: 'page' } as any },
      })
    ).rejects.toThrow(/requires a defined schema object/i);

    await expect(
      invokeLLM({
        messages: [{ role: 'user', content: 'return json' }],
        outputSchema: { name: '', schema: { type: 'object' } },
      })
    ).rejects.toThrow(/requires both name and schema/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('response passthrough and errors', () => {
  it('returns the Forge response in OpenAI-compatible shape without extra conversion', async () => {
    const resultPayload = {
      ...defaultResult,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'done',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: {
                  name: 'lookup',
                  arguments: '{"id":"123"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
    fetchMock.mockResolvedValue(forgeResponse(resultPayload));

    const result = await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toEqual(resultPayload);
  });

  it('throws before fetch when forgeApiKey is missing', async () => {
    mockEnv.forgeApiKey = '';

    await expect(
      invokeLLM({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow('OPENAI_API_KEY is not configured');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws with status and body text on non-ok responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'bad key',
    });

    await expect(
      invokeLLM({ messages: [{ role: 'user', content: 'hi' }] })
    ).rejects.toThrow(/401.*Unauthorized.*bad key/s);
  });
});

describe('parseLLMContent', () => {
  it('parses valid JSON strings', () => {
    expect(parseLLMContent<{ a: number }>(JSON.stringify({ a: 1 }))).toEqual({ a: 1 });
  });

  it('throws on non-string and invalid JSON content', () => {
    expect(() => parseLLMContent(undefined)).toThrow(/non-string/i);
    expect(() => parseLLMContent('not json')).toThrow(/unparseable json/i);
  });
});
