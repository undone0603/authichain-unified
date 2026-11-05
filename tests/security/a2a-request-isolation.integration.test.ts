import { describe, expect, it } from "vitest";
import { handleA2aJsonRpc } from "../../src/lib/a2a-jsonrpc";

// Regression test against the REAL handler, not the illustrative offline model.
// Expected to fail on main until the request-local default-store fix from #2269
// is incorporated into an independently reviewed integration branch.
const rpc = (method: string, params: unknown, id = 1) =>
  JSON.stringify({ jsonrpc: "2.0", id, method, params });
const send = (id: string) => rpc("SendMessage", {
  message: { messageId: id, role: "ROLE_USER", parts: [{ text: "offline trust regression" }] }
});
describe("A2A anonymous request isolation (actual handler)", () => {
  it("does not expose a task from a previous request through the implicit store", () => {
    const created = handleA2aJsonRpc(send("isolated-request-1"));
    expect(created.status).toBe(200);
    const taskId = (created.body as {result:{task:{id:string}}}).result.task.id;
    expect(taskId).toBeTruthy();
    const otherRequest = handleA2aJsonRpc(rpc("GetTask", { id: taskId }, 2));
    const body = otherRequest.body as {result?:unknown;error?:{code:number}};
    expect(body.result).toBeUndefined();
    expect(body.error).toBeDefined();
  });
});
