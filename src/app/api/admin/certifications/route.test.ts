import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const { dppInsertError, nfcInsertError } = vi.hoisted(() => ({
  dppInsertError: { current: null as null | { message: string } },
  nfcInsertError: { current: null as null | { message: string } },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-1", email: "owner@example.com" } },
      }),
    },
    from: (table: string) => {
      if (table === "certifications") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "cert-1" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "dpp_data") {
        return { insert: async () => ({ error: dppInsertError.current }) };
      }
      if (table === "nfc_tags") {
        return { insert: async () => ({ error: nfcInsertError.current }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock("@/lib/require-admin", () => ({
  requireAdmin: async () => ({ user: { id: "admin-1" } }),
}));

import { POST } from "./route";

describe("POST /api/admin/certifications", () => {
  const request = () =>
    new NextRequest("https://authichain.com/api/admin/certifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        product_id: "product-1",
        dpp_data: { material_composition: "steel" },
        nfc_uid: "nfc-1",
      }),
    });

  it("returns an error when the requested DPP row is not persisted", async () => {
    dppInsertError.current = { message: "DPP insert failed" };
    nfcInsertError.current = null;
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "DPP insert failed" });
  });

  it("returns an error when the requested NFC tag is not persisted", async () => {
    dppInsertError.current = null;
    nfcInsertError.current = { message: "NFC insert failed" };
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "NFC insert failed" });
  });
});
