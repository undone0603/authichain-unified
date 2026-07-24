import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; setCookieHeaders: string[] } {
  const setCookieHeaders: string[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    stripeCustomerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as any;

  const ctx: TrpcContext = {
    user,
    secure: true,
    setCookieHeader: (value: string) => { setCookieHeaders.push(value); },
    // req/res are still on the Express TrpcContext type; provide minimal stubs
    // so the object satisfies the type (they are now unused by logout):
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx, setCookieHeaders };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, setCookieHeaders } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(setCookieHeaders).toHaveLength(1);
    const header = setCookieHeaders[0];
    expect(header).toContain(`${COOKIE_NAME}=`);
    expect(header).toContain("Max-Age=0");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
  });
});
