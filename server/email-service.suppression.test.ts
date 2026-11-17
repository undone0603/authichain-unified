import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { getDb } from "./db";

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    }),
  })),
}));

const { isSuppressed } = await import("./email-service");

describe("isSuppressed", () => {
  const previous = ENV.suppressionList;

  afterEach(() => {
    ENV.suppressionList = previous;
    vi.mocked(getDb).mockReset();
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);
  });

  it("honors SUPPRESSION_LIST as an extra source without querying the table", async () => {
    ENV.suppressionList = "env-blocked@example.com";
    await expect(isSuppressed("env-blocked@example.com")).resolves.toBe(true);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("reads guardrail_suppression_list from the database", async () => {
    ENV.suppressionList = "";
    vi.mocked(getDb).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ email: "db-blocked@example.com" }],
          }),
        }),
      }),
    } as never);
    await expect(isSuppressed("db-blocked@example.com")).resolves.toBe(true);
  });

  it("fails closed when neither the database nor REST can establish status", async () => {
    ENV.suppressionList = "";
    vi.mocked(getDb).mockRejectedValueOnce(new Error("db down"));
    const previousUrl = process.env.SUPABASE_URL;
    const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      await expect(isSuppressed("maybe@example.com")).resolves.toBe(true);
    } finally {
      if (previousUrl !== undefined) process.env.SUPABASE_URL = previousUrl;
      if (previousPublicUrl !== undefined) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl;
      }
      if (previousKey !== undefined) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      }
    }
  });

  describe("Supabase REST fallback", () => {
    const previousUrl = process.env.SUPABASE_URL;
    const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    beforeEach(() => {
      ENV.suppressionList = "";
      vi.mocked(getDb).mockRejectedValue(new Error("db down"));
      process.env.SUPABASE_URL = "https://db.example.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      if (previousUrl !== undefined) process.env.SUPABASE_URL = previousUrl;
      else delete process.env.SUPABASE_URL;
      if (previousPublicUrl !== undefined) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (previousKey !== undefined) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
      } else {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });

    it("suppresses when REST returns a matching row", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify([{ email: "rest-blocked@example.com" }]),
            {
              status: 200,
            }
          )
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(isSuppressed("rest-blocked@example.com")).resolves.toBe(
        true
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("allows a recipient when REST returns no row", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
      );
      await expect(isSuppressed("clear@example.com")).resolves.toBe(false);
    });

    it("fails closed when REST errors", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("nope", { status: 500 }))
      );
      await expect(isSuppressed("maybe@example.com")).resolves.toBe(true);
    });

    it("fails closed when REST times out", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url: unknown, init?: RequestInit) =>
            new Promise<Response>((_, reject) => {
              const signal = init?.signal;
              if (!signal) return;
              const onAbort = () => {
                const err = new Error("Aborted");
                err.name = "AbortError";
                reject(err);
              };
              if (signal.aborted) onAbort();
              else signal.addEventListener("abort", onAbort);
            })
        )
      );
      await expect(isSuppressed("slow@example.com")).resolves.toBe(true);
    });
  });
});
