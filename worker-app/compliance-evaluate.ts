import { Hono } from "hono";
import { evaluateComplianceRequest } from "../src/lib/compliance/evaluate-request";

const NO_STORE = { "Cache-Control": "no-store" };

export function registerComplianceEvaluate(app: Hono): void {
  app.post("/api/v1/compliance/evaluate", async c => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400, NO_STORE);
    }
    const result = evaluateComplianceRequest(body);
    return c.json(result.body, result.status as 200 | 400 | 500, NO_STORE);
  });
}
