import { DurableObject } from "cloudflare:workers";

export class AuthiChainAgent extends DurableObject {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === '/state') {
      const state = await this.ctx.storage.get("memory") || {};
      return new Response(JSON.stringify(state));
    }
    return new Response("Agent State Active");
  }

  async updateMemory(newData: any) {
    const current: any = await this.ctx.storage.get("memory") || {};
    await this.ctx.storage.put("memory", { ...current, ...newData });
  }
}
