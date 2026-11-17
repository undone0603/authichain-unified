import { describe, expect, it } from "vitest";
import {
  handleA2aJsonRpc,
  memoryA2aStore,
} from "./a2a-jsonrpc";

const NOW = new Date("2026-10-29T16:45:00.000Z");

function call(method: string, params: unknown, id: number | string = 1) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

describe("A2A JSON-RPC", () => {
  it("SendMessage completes a task and does not settle", () => {
    const store = memoryA2aStore();
    const res = handleA2aJsonRpc(
      call("SendMessage", {
        message: {
          messageId: "m1",
          role: "ROLE_USER",
          parts: [{ text: "check this seal" }],
        },
      }),
      { store, now: NOW }
    );
    expect(res.status).toBe(200);
    const body = res.body as {
      result: {
        task: {
          status: { state: string };
          artifacts: Array<{ parts: Array<{ text: string }> }>;
          id: string;
        };
      };
    };
    expect(body.result.task.status.state).toBe("TASK_STATE_COMPLETED");
    const text = body.result.task.artifacts[0].parts[0].text;
    expect(text).toContain("A valid signature is not real-world truth");
    expect(text).toContain("https://authichain.com/api/x402");
    expect(text).toContain("does not settle");
    const again = handleA2aJsonRpc(
      call("SendMessage", {
        message: {
          messageId: "m2",
          role: "ROLE_USER",
          parts: [{ text: "again" }],
          taskId: body.result.task.id,
        },
      }),
      { store, now: NOW }
    );
    expect((again.body as { error: { code: number } }).error.code).toBe(-32004);
  });

  it("GetTask honors historyLength and ListTasks omits artifacts", () => {
    const store = memoryA2aStore();
    const sent = handleA2aJsonRpc(
      call("SendMessage", {
        message: {
          messageId: "m1",
          contextId: "ctx-1",
          parts: [{ text: "hello" }],
        },
      }),
      { store, now: NOW }
    );
    const id = (
      sent.body as { result: { task: { id: string } } }
    ).result.task.id;
    const got = handleA2aJsonRpc(
      call("GetTask", { id, historyLength: 0 }, 2),
      { store, now: NOW }
    );
    expect(
      (got.body as { result: { history: unknown[] } }).result.history
    ).toEqual([]);
    const listed = handleA2aJsonRpc(call("ListTasks", {}, 3), {
      store,
      now: NOW,
    });
    const tasks = (
      listed.body as { result: { tasks: Array<Record<string, unknown>>; nextPageToken: string; totalSize: number } }
    ).result;
    expect(tasks.totalSize).toBe(1);
    expect(tasks.nextPageToken).toBe("");
    expect(tasks.tasks[0]).not.toHaveProperty("artifacts");
    const missing = handleA2aJsonRpc(call("GetTask", { id: "nope" }, 4), {
      store,
      now: NOW,
    });
    expect((missing.body as { error: { code: number } }).error.code).toBe(-32001);
  });

  it("refuses streaming, push, extended card, old version, and file parts", () => {
    const store = memoryA2aStore();
    const cases: Array<[string, unknown, number]> = [
      ["SendStreamingMessage", { message: { parts: [{ text: "x" }] } }, -32004],
      ["SubscribeToTask", { id: "missing" }, -32004],
      ["CreateTaskPushNotificationConfig", { url: "https://example.com/hook" }, -32003],
      ["GetExtendedAgentCard", {}, -32007],
      ["NoSuchMethod", {}, -32601],
    ];
    for (const [method, params, code] of cases) {
      const res = handleA2aJsonRpc(call(method, params), { store, now: NOW });
      expect((res.body as { error: { code: number } }).error.code).toBe(code);
    }
    const file = handleA2aJsonRpc(
      call("SendMessage", {
        message: { parts: [{ kind: "file", file: { uri: "https://example.com/a" } }] },
      }),
      { store, now: NOW }
    );
    expect((file.body as { error: { code: number } }).error.code).toBe(-32005);
    const old = handleA2aJsonRpc(
      call("GetTask", { id: "x" }),
      { store, now: NOW, a2aVersion: "0.3" }
    );
    expect((old.body as { error: { code: number } }).error.code).toBe(-32009);
    const bad = handleA2aJsonRpc("{", { store, now: NOW });
    expect((bad.body as { error: { code: number } }).error.code).toBe(-32700);
  });

  it("default JSON-RPC store never leaks task history across calls", () => {
    const created = handleA2aJsonRpc(
      call("SendMessage", { message: { parts: [{ text: "private-agent-payload" }] } }),
      { now: NOW }
    );
    const taskId = (created.body as {
      result: { task: { id: string } }
    }).result.task.id;

    // Neither call supplies a trusted tenant-scoped persistent store.
    const listing = handleA2aJsonRpc(call("ListTasks", {}), { now: NOW });
    const listed = (listing.body as { result: { tasks: unknown[]; totalSize: number } }).result;
    expect(listed.totalSize).toBe(0);
    expect(listed.tasks).toEqual([]);
    expect(JSON.stringify(listing)).not.toContain("private-agent-payload");

    const read = handleA2aJsonRpc(call("GetTask", { id: taskId }), { now: NOW });
    expect((read.body as { error: { code: number } }).error.code).toBe(-32001);
  });

  it("default JSON-RPC store is shared only within the current RPC batch", () => {
    const batch = JSON.stringify([
      { jsonrpc: "2.0", id: 1, method: "SendMessage",
        params: { message: { parts: [{ text: "ephemeral-batch-only" }] } } },
      { jsonrpc: "2.0", id: 2, method: "ListTasks", params: {} },
    ]);
    const response = handleA2aJsonRpc(batch, { now: NOW });
    const replies = response.body as Array<{
      result: { task?: { id: string }; tasks?: unknown[] }
    }>;
    expect(replies[0].result.task?.id).toBeTruthy();
    expect(replies[1].result.tasks).toHaveLength(1);
    const after = handleA2aJsonRpc(call("ListTasks", {}), { now: NOW });
    expect((after.body as { result: { totalSize: number } }).result.totalSize).toBe(0);
  });

  it("CancelTask on a completed task is not cancelable", () => {
    const store = memoryA2aStore();
    const sent = handleA2aJsonRpc(
      call("SendMessage", { message: { parts: [{ text: "hi" }] } }),
      { store, now: NOW }
    );
    const id = (sent.body as { result: { task: { id: string } } }).result.task.id;
    const canceled = handleA2aJsonRpc(call("CancelTask", { id }, 9), {
      store,
      now: NOW,
    });
    expect((canceled.body as { error: { code: number } }).error.code).toBe(-32002);
    expect(store.get(id)?.status.state).toBe("TASK_STATE_COMPLETED");
  });
});
