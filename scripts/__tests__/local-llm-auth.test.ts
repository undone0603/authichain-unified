import { describe, expect, it } from "vitest";
import {
  isPrivateLlmUrl,
  localLlmHeaders,
  localLlmToken,
} from "../lib/local-llm-auth.mjs";

describe("local LM Studio auth", () => {
  it("reads LM_STUDIO_API_TOKEN first", () => {
    expect(
      localLlmToken({
        LM_STUDIO_API_TOKEN: " from-token ",
        LM_STUDIO_API_KEY: "from-key",
      })
    ).toBe("from-token");
  });

  it("falls back to LM_STUDIO_API_KEY", () => {
    expect(localLlmToken({ LM_STUDIO_API_KEY: "from-key" })).toBe("from-key");
  });

  it("treats loopback and RFC1918 as private", () => {
    expect(isPrivateLlmUrl("http://127.0.0.1:49178/v1")).toBe(true);
    expect(isPrivateLlmUrl("http://localhost:1234")).toBe(true);
    expect(isPrivateLlmUrl("http://192.168.254.10:1234")).toBe(true);
    expect(isPrivateLlmUrl("https://example.com/v1")).toBe(false);
    expect(isPrivateLlmUrl("not a url")).toBe(false);
  });

  it("adds Bearer only on a private URL when a token is set", () => {
    const env = { LM_STUDIO_API_TOKEN: "test-token" };
    expect(localLlmHeaders("http://127.0.0.1:49178", env)).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    });
    expect(localLlmHeaders("http://192.168.254.10:1234", env).Authorization).toBe(
      "Bearer test-token"
    );
    expect(localLlmHeaders("https://api.groq.com", env).Authorization).toBeUndefined();
    expect(localLlmHeaders("http://127.0.0.1:49178", {}).Authorization).toBeUndefined();
  });
});
