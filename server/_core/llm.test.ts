import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./env', () => ({ ENV: { anthropicApiKey: 'test-key' } }));

// Prompt-cache DB lookups are best-effort/fail-open; stub getDb to reject so
// every test exercises the real API-call path deterministically.
vi.mock('../db.js', () => ({ getDb: vi.fn(async () => { throw new Error('no db in tests'); }) }));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function anthropicResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      id: 'msg_123',
      model: 'claude-haiku-4-5-20251001',
      content: [{ type: 'text', text: 'hello' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
      ...overrides,
    }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
});

// Imported after mocks so the module picks up the mocked ENV/getDb.
const { invokeLLM, parseLLMContent } = await import('./llm');

describe('invokeLLM request shape', () => {
  it('calls the Anthropic Messages API with the API key header', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-key');
    expect(init.headers['anthropic-version']).toBeTruthy();
  });

  it('extracts system-role messages into the top-level system field', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hi' },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe('You are helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('throws before calling fetch when the API key is missing', async () => {
    vi.doMock('./env', () => ({ ENV: { anthropicApiKey: '' } }));
    vi.resetModules();
    const { invokeLLM: invokeLLMNoKey } = await import('./llm');
    await expect(invokeLLMNoKey({ messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.doUnmock('./env');
  });
});

describe('response conversion to OpenAI-compatible shape', () => {
  it('maps a plain text response into choices[0].message.content', async () => {
    fetchMock.mockResolvedValue(anthropicResponse({ content: [{ type: 'text', text: 'the answer' }] }));
    const result = await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result.choices[0].message.content).toBe('the answer');
    expect(result.choices[0].message.role).toBe('assistant');
    expect(result.choices[0].finish_reason).toBe('stop');
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
  });

  it('maps stop_reason tool_use to finish_reason tool_calls', async () => {
    fetchMock.mockResolvedValue(anthropicResponse({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'navigate', input: { url: 'https://x.com' } }],
    }));
    const result = await invokeLLM({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'navigate', parameters: {} } }],
    });

    expect(result.choices[0].finish_reason).toBe('tool_calls');
    expect(result.choices[0].message.tool_calls).toEqual([
      { id: 'toolu_1', type: 'function', function: { name: 'navigate', arguments: JSON.stringify({ url: 'https://x.com' }) } },
    ]);
  });

  it('maps stop_reason max_tokens to finish_reason length', async () => {
    fetchMock.mockResolvedValue(anthropicResponse({ stop_reason: 'max_tokens' }));
    const result = await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.choices[0].finish_reason).toBe('length');
  });
});

describe('tool round-tripping (agentic loop, e.g. browser-vision.ts)', () => {
  it('converts an assistant message carrying tool_calls into tool_use content blocks', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [
        { role: 'user', content: 'go' },
        {
          role: 'assistant',
          content: '',
          // @ts-expect-error tool_calls attached like browser-vision.ts does
          tool_calls: [{ id: 'toolu_1', type: 'function', function: { name: 'navigate', arguments: '{"url":"https://x.com"}' } }],
        },
        { role: 'tool', content: 'ok', tool_call_id: 'toolu_1', name: 'navigate' },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'navigate', input: { url: 'https://x.com' } }],
    });
    expect(body.messages[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }],
    });
  });

  it('converts caller-supplied OpenAI-shaped tools into Anthropic tool definitions', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'navigate', description: 'go somewhere', parameters: { type: 'object' } } }],
      toolChoice: 'required',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual([{ name: 'navigate', description: 'go somewhere', input_schema: { type: 'object' } }]);
    expect(body.tool_choice).toEqual({ type: 'any' });
  });
});

describe('image content conversion', () => {
  it('converts a data: URI image into an Anthropic base64 source', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'what is this' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,ABCD1234' } },
        ],
      }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'what is this' },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'ABCD1234' } },
    ]);
  });

  it('converts a plain http(s) image URL into an Anthropic url source', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://x.com/a.png' } }] }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([{ type: 'image', source: { type: 'url', url: 'https://x.com/a.png' } }]);
  });

  it('rejects unsupported file_url mime types loudly instead of mishandling them', async () => {
    await expect(invokeLLM({
      messages: [{ role: 'user', content: [{ type: 'file_url', file_url: { url: 'https://x.com/a.mp3', mime_type: 'audio/mpeg' } }] }],
    })).rejects.toThrow(/audio\/mpeg/);
  });
});

describe('structured JSON output via forced tool-use', () => {
  it('forces a tool call for responseFormat json_schema and returns its input as content', async () => {
    fetchMock.mockResolvedValue(anthropicResponse({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'toolu_1', name: '__structured_output', input: { title: 'T', body: 'B' } }],
    }));
    const result = await invokeLLM({
      messages: [{ role: 'user', content: 'write something' }],
      responseFormat: { type: 'json_schema', json_schema: { name: 'page', schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } } } } },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toEqual([{ name: '__structured_output', description: expect.any(String), input_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } } } }]);
    expect(body.tool_choice).toEqual({ type: 'tool', name: '__structured_output' });

    expect(result.choices[0].message.content).toBe(JSON.stringify({ title: 'T', body: 'B' }));
    expect(result.choices[0].message.tool_calls).toBeUndefined();
    expect(() => parseLLMContent(result.choices[0].message.content)).not.toThrow();
  });

  it('forces a permissive tool call for responseFormat json_object', async () => {
    fetchMock.mockResolvedValue(anthropicResponse({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 'toolu_1', name: '__structured_output', input: { anything: 'goes' } }],
    }));
    const result = await invokeLLM({
      messages: [{ role: 'user', content: 'give me json' }],
      responseFormat: { type: 'json_object' },
    });

    expect(result.choices[0].message.content).toBe(JSON.stringify({ anything: 'goes' }));
  });

  it('does not force a tool for plain text (no responseFormat)', async () => {
    fetchMock.mockResolvedValue(anthropicResponse());
    await invokeLLM({ messages: [{ role: 'user', content: 'hi' }] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });
});

describe('error handling', () => {
  it('throws with status and body text on a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => 'bad key' });
    await expect(invokeLLM({ messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow(/401.*bad key/s);
  });
});

describe('parseLLMContent', () => {
  it('parses valid JSON content', () => {
    expect(parseLLMContent<{ a: number }>(JSON.stringify({ a: 1 }))).toEqual({ a: 1 });
  });

  it('throws on non-string content', () => {
    expect(() => parseLLMContent(undefined)).toThrow();
  });
});
