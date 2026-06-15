import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";

const BASE_URL = process.env.MACROHARD_API_URL ?? "";
const API_KEY = process.env.MACROHARD_API_KEY ?? "";

async function mhFetch(path: string, options: RequestInit = {}) {
  if (!BASE_URL || !API_KEY) throw new Error("MACROHARD integration not configured");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Macrohard-Key": API_KEY,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`MACROHARD API error ${res.status}`);
  return res.json();
}

export const macrohardRouter = router({
  /** Check connection status and API health */
  status: adminProcedure.query(async () => {
    const configured = !!(BASE_URL && API_KEY);
    if (!configured) return { configured, connected: false, version: null };
    try {
      const data = await mhFetch("/health");
      return { configured, connected: true, version: data.version ?? null };
    } catch (e: any) {
      return { configured, connected: false, version: null, error: e.message };
    }
  }),

  /** Get the configuration / integration settings */
  getConfig: adminProcedure.query(async () => {
    return {
      apiUrl: BASE_URL ? BASE_URL.replace(/^https?:\/\//, "").split("/")[0] : null,
      configured: !!(BASE_URL && API_KEY),
    };
  }),

  /** Sync data from MACROHARD into AuthiChain */
  sync: adminProcedure
    .input(z.object({ entity: z.enum(["products", "users", "inventory", "all"]) }))
    .mutation(async ({ input }) => {
      const data = await mhFetch(`/sync/${input.entity}`, { method: "POST" });
      return {
        entity: input.entity,
        synced: data.count ?? 0,
        timestamp: new Date().toISOString(),
      };
    }),

  /** Generic query — fetch a resource from MACROHARD */
  query: adminProcedure
    .input(
      z.object({
<<<<<<< HEAD
        resource: z.string().min(1).max(100),
=======
        // Only allow simple alphanumeric/hyphen/underscore resource names — no path traversal
        resource: z.string().min(1).max(100).regex(/^[\w\-]+$/, "Invalid resource name"),
>>>>>>> origin/add-agentz-editable
        params: z.record(z.string(), z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const qs = input.params
        ? "?" + new URLSearchParams(input.params).toString()
        : "";
      const data = await mhFetch(`/api/${input.resource}${qs}`);
      return data;
    }),

  /** Push an AuthiChain product/certificate event to MACROHARD */
  pushEvent: adminProcedure
    .input(
      z.object({
        eventType: z.enum(["product_authenticated", "certificate_issued", "nft_minted"]),
        payload: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      const data = await mhFetch("/events", {
        method: "POST",
        body: JSON.stringify({ type: input.eventType, data: input.payload }),
      });
      return { success: true, eventId: data.id ?? null };
    }),
});
