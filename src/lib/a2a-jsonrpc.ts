/**
 * A2A 1.0 JSON-RPC binding for AuthiChain.
 *
 * Methods follow the 1.0 spec (PascalCase): SendMessage, GetTask, ListTasks,
 * CancelTask. Streaming, push, and the extended card are refused with the
 * spec error codes because the agent card declares those capabilities off.
 * This handler never settles a payment and never treats a signature as
 * real-world truth.
 */

export const A2A_RPC_PATH = "/api/a2a";
export const A2A_PROTOCOL_VERSION = "1.0";

const EVIDENCE_TEXT =
  "Paid evidence check for agents: signed record, machine-readable verification result, explicit unknowns, and a settlement receipt. A valid signature is not real-world truth. POST https://authichain.com/api/x402 or https://authichain.com/api/v1/agent-verify. Unpaid calls return HTTP 402 for 50000 units of USDC on Base. This JSON-RPC method does not pay and does not settle.";

export const A2A_METHODS = [
  "SendMessage",
  "SendStreamingMessage",
  "GetTask",
  "ListTasks",
  "CancelTask",
  "SubscribeToTask",
  "CreateTaskPushNotificationConfig",
  "GetTaskPushNotificationConfig",
  "ListTaskPushNotificationConfigs",
  "DeleteTaskPushNotificationConfig",
  "GetExtendedAgentCard",
] as const;

type JsonRpcId = string | number | null;

export type A2aPart = { text: string };

export type A2aMessage = {
  messageId: string;
  role: "ROLE_USER" | "ROLE_AGENT";
  parts: A2aPart[];
  contextId?: string;
  taskId?: string;
};

export type A2aTask = {
  id: string;
  contextId: string;
  status: { state: "TASK_STATE_COMPLETED"; timestamp: string };
  history: A2aMessage[];
  artifacts?: Array<{
    artifactId: string;
    name: string;
    parts: A2aPart[];
  }>;
};

export type A2aStore = {
  get(id: string): A2aTask | undefined;
  put(task: A2aTask): void;
  list(): A2aTask[];
};

export function memoryA2aStore(): A2aStore {
  const tasks = new Map<string, A2aTask>();
  return {
    get: id => tasks.get(id),
    put: task => {
      tasks.set(task.id, task);
    },
    list: () => [...tasks.values()],
  };
}

const defaultStore = memoryA2aStore();

type RpcError = { code: number; message: string; data?: unknown[] };

const PARSE: RpcError = { code: -32700, message: "Invalid JSON payload" };
const INVALID_REQUEST: RpcError = {
  code: -32600,
  message: "Request payload validation error",
};
const METHOD_NOT_FOUND: RpcError = { code: -32601, message: "Method not found" };
const INVALID_PARAMS: RpcError = { code: -32602, message: "Invalid parameters" };

function a2aError(
  code: number,
  message: string,
  reason: string,
  metadata?: Record<string, string>
): RpcError {
  return {
    code,
    message,
    data: [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason,
        domain: "a2a-protocol.org",
        ...(metadata ? { metadata } : {}),
      },
    ],
  };
}

function result(id: JsonRpcId, value: unknown) {
  return { jsonrpc: "2.0" as const, id, result: value };
}

function failure(id: JsonRpcId, error: RpcError) {
  return { jsonrpc: "2.0" as const, id, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textOf(part: unknown): string | null | "unsupported" {
  if (!isRecord(part)) return "unsupported";
  if ("file" in part || part.kind === "file") return "unsupported";
  const mime = part.mimeType ?? part.mediaType;
  if (
    typeof mime === "string" &&
    mime !== "text/plain" &&
    mime !== "application/json"
  ) {
    return "unsupported";
  }
  if (typeof part.text === "string") return part.text;
  if (isRecord(part.text) || typeof part.data === "string") return "unsupported";
  return null;
}

function readMessage(raw: unknown): A2aMessage | RpcError {
  if (!isRecord(raw)) return INVALID_PARAMS;
  const partsRaw = raw.parts;
  if (!Array.isArray(partsRaw) || partsRaw.length === 0) return INVALID_PARAMS;
  const parts: A2aPart[] = [];
  for (const part of partsRaw) {
    const text = textOf(part);
    if (text === "unsupported") {
      return a2aError(
        -32005,
        "Content type not supported",
        "CONTENT_TYPE_NOT_SUPPORTED"
      );
    }
    if (text === null) return INVALID_PARAMS;
    parts.push({ text });
  }
  const messageId =
    typeof raw.messageId === "string" && raw.messageId
      ? raw.messageId
      : crypto.randomUUID();
  const message: A2aMessage = {
    messageId,
    role: "ROLE_USER",
    parts,
  };
  if (typeof raw.contextId === "string" && raw.contextId) {
    message.contextId = raw.contextId;
  }
  if (typeof raw.taskId === "string" && raw.taskId) {
    message.taskId = raw.taskId;
  }
  return message;
}

function visibleTask(task: A2aTask, historyLength: unknown): Record<string, unknown> {
  const copy: Record<string, unknown> = {
    id: task.id,
    contextId: task.contextId,
    status: task.status,
    artifacts: task.artifacts,
  };
  if (historyLength === undefined) {
    copy.history = task.history;
  } else if (historyLength === 0) {
    copy.history = [];
  } else if (typeof historyLength === "number" && historyLength > 0) {
    copy.history = task.history.slice(-historyLength);
  } else {
    copy.history = task.history;
  }
  return copy;
}

function withoutArtifacts(task: Record<string, unknown>): Record<string, unknown> {
  const { artifacts: _artifacts, ...rest } = task;
  return rest;
}

function sendMessage(
  params: unknown,
  store: A2aStore,
  now: Date
): { ok: true; value: unknown } | { ok: false; error: RpcError } {
  if (!isRecord(params) || !isRecord(params.message)) {
    return { ok: false, error: INVALID_PARAMS };
  }
  const message = readMessage(params.message);
  if ("code" in message) return { ok: false, error: message };
  if (message.taskId) {
    const existing = store.get(message.taskId);
    if (existing) {
      return {
        ok: false,
        error: a2aError(
          -32004,
          "Task is already in a terminal state",
          "UNSUPPORTED_OPERATION",
          { taskId: existing.id }
        ),
      };
    }
  }
  const id = message.taskId || crypto.randomUUID();
  const contextId = message.contextId || crypto.randomUUID();
  const agentMessage: A2aMessage = {
    messageId: crypto.randomUUID(),
    role: "ROLE_AGENT",
    parts: [{ text: EVIDENCE_TEXT }],
    contextId,
    taskId: id,
  };
  const task: A2aTask = {
    id,
    contextId,
    status: {
      state: "TASK_STATE_COMPLETED",
      timestamp: now.toISOString(),
    },
    history: [{ ...message, contextId, taskId: id }, agentMessage],
    artifacts: [
      {
        artifactId: crypto.randomUUID(),
        name: "evidence-check",
        parts: [{ text: EVIDENCE_TEXT }],
      },
    ],
  };
  store.put(task);
  return { ok: true, value: { task } };
}

function getTask(
  params: unknown,
  store: A2aStore
): { ok: true; value: unknown } | { ok: false; error: RpcError } {
  if (!isRecord(params) || typeof params.id !== "string" || !params.id) {
    return { ok: false, error: INVALID_PARAMS };
  }
  const task = store.get(params.id);
  if (!task) {
    return {
      ok: false,
      error: a2aError(-32001, "Task not found", "TASK_NOT_FOUND", {
        taskId: params.id,
      }),
    };
  }
  return { ok: true, value: visibleTask(task, params.historyLength) };
}

function listTasks(
  params: unknown,
  store: A2aStore
): { ok: true; value: unknown } | { ok: false; error: RpcError } {
  const query = isRecord(params) ? params : {};
  let pageSize = 50;
  if (query.pageSize !== undefined) {
    if (
      typeof query.pageSize !== "number" ||
      !Number.isInteger(query.pageSize) ||
      query.pageSize < 1 ||
      query.pageSize > 100
    ) {
      return { ok: false, error: INVALID_PARAMS };
    }
    pageSize = query.pageSize;
  }
  let offset = 0;
  if (typeof query.pageToken === "string" && query.pageToken) {
    const parsed = Number(query.pageToken);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, error: INVALID_PARAMS };
    }
    offset = parsed;
  }
  let tasks = store.list();
  if (typeof query.contextId === "string") {
    tasks = tasks.filter(task => task.contextId === query.contextId);
  }
  if (typeof query.status === "string") {
    tasks = tasks.filter(task => task.status.state === query.status);
  }
  if (typeof query.statusTimestampAfter === "string") {
    const after = Date.parse(query.statusTimestampAfter);
    if (Number.isNaN(after)) return { ok: false, error: INVALID_PARAMS };
    tasks = tasks.filter(task => Date.parse(task.status.timestamp) >= after);
  }
  tasks.sort(
    (a, b) =>
      Date.parse(b.status.timestamp) - Date.parse(a.status.timestamp)
  );
  const page = tasks.slice(offset, offset + pageSize);
  const includeArtifacts = query.includeArtifacts === true;
  const shown = page.map(task => {
    const visible = visibleTask(task, query.historyLength);
    return includeArtifacts ? visible : withoutArtifacts(visible);
  });
  const next = offset + page.length;
  return {
    ok: true,
    value: {
      tasks: shown,
      nextPageToken: next < tasks.length ? String(next) : "",
      pageSize,
      totalSize: tasks.length,
    },
  };
}

function dispatch(
  method: string,
  params: unknown,
  store: A2aStore,
  now: Date
): { ok: true; value: unknown } | { ok: false; error: RpcError } {
  switch (method) {
    case "SendMessage":
      return sendMessage(params, store, now);
    case "GetTask":
      return getTask(params, store);
    case "ListTasks":
      return listTasks(params, store);
    case "CancelTask": {
      if (!isRecord(params) || typeof params.id !== "string" || !params.id) {
        return { ok: false, error: INVALID_PARAMS };
      }
      const task = store.get(params.id);
      if (!task) {
        return {
          ok: false,
          error: a2aError(-32001, "Task not found", "TASK_NOT_FOUND", {
            taskId: params.id,
          }),
        };
      }
      return {
        ok: false,
        error: a2aError(
          -32002,
          "Task is not cancelable",
          "TASK_NOT_CANCELABLE",
          { taskId: task.id }
        ),
      };
    }
    case "SendStreamingMessage":
    case "SubscribeToTask":
      return {
        ok: false,
        error: a2aError(
          -32004,
          "Streaming is not supported",
          "UNSUPPORTED_OPERATION"
        ),
      };
    case "CreateTaskPushNotificationConfig":
    case "GetTaskPushNotificationConfig":
    case "ListTaskPushNotificationConfigs":
    case "DeleteTaskPushNotificationConfig":
      return {
        ok: false,
        error: a2aError(
          -32003,
          "Push notifications are not supported",
          "PUSH_NOTIFICATION_NOT_SUPPORTED"
        ),
      };
    case "GetExtendedAgentCard":
      return {
        ok: false,
        error: a2aError(
          -32007,
          "Extended agent card is not configured",
          "EXTENDED_AGENT_CARD_NOT_CONFIGURED"
        ),
      };
    default:
      return { ok: false, error: METHOD_NOT_FOUND };
  }
}

function versionError(header: string | null): RpcError | null {
  if (!header || !header.trim()) return null;
  const value = header.trim();
  if (value === "1.0" || value === "1.0.0" || value === "1") return null;
  return a2aError(
    -32009,
    "A2A version is not supported",
    "VERSION_NOT_SUPPORTED",
    { requested: value }
  );
}

export type A2aHttpResult = {
  status: number;
  body: unknown | null;
};

function oneCall(
  call: unknown,
  store: A2aStore,
  now: Date,
  version: RpcError | null
): { id: JsonRpcId; body: Record<string, unknown> } | null {
  if (!isRecord(call) || call.jsonrpc !== "2.0" || typeof call.method !== "string") {
    const id = isRecord(call) && (typeof call.id === "string" || typeof call.id === "number")
      ? call.id
      : null;
    return { id, body: failure(id, INVALID_REQUEST) };
  }
  const id = call.id;
  const hasId = typeof id === "string" || typeof id === "number" || id === null;
  if (!hasId) return { id: null, body: failure(null, INVALID_REQUEST) };
  if (version) return { id, body: failure(id, version) };
  if (!("id" in call)) return null;
  const outcome = dispatch(call.method, call.params, store, now);
  if (!outcome.ok) return { id, body: failure(id, outcome.error) };
  return { id, body: result(id, outcome.value) };
}

export function handleA2aJsonRpc(
  raw: string,
  opts: {
    store?: A2aStore;
    now?: Date;
    a2aVersion?: string | null;
  } = {}
): A2aHttpResult {
  const store = opts.store ?? defaultStore;
  const now = opts.now ?? new Date();
  const version = versionError(opts.a2aVersion ?? null);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 200, body: failure(null, PARSE) };
  }
  if (Array.isArray(parsed)) {
    const responses = parsed
      .map(call => oneCall(call, store, now, version))
      .filter((item): item is { id: JsonRpcId; body: Record<string, unknown> } => item !== null)
      .map(item => item.body);
    if (responses.length === 0) return { status: 204, body: null };
    return { status: 200, body: responses };
  }
  const single = oneCall(parsed, store, now, version);
  if (!single) return { status: 204, body: null };
  return { status: 200, body: single.body };
}

export function a2aMethodList() {
  return {
    protocol: "A2A",
    protocolVersion: A2A_PROTOCOL_VERSION,
    binding: "JSONRPC",
    endpoint: `https://authichain.com${A2A_RPC_PATH}`,
    streaming: false,
    pushNotifications: false,
    methods: [...A2A_METHODS],
  };
}
