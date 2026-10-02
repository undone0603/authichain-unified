import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  maxGitHubPayloadBytes,
  normalizeGitHubWebhook,
  verifyGitHubSignature,
} from "./si-github-webhook";

describe("SI Feed GitHub webhook normalization", () => {
  it("verifies GitHub SHA-256 signatures and rejects missing or altered signatures", () => {
    const body = Buffer.from('{"action":"completed"}');
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;

    expect(verifyGitHubSignature(body, signature, "secret")).toBe(true);
    expect(verifyGitHubSignature(body, signature, undefined)).toBe(false);
    expect(
      verifyGitHubSignature(body, `${signature.slice(0, -1)}0`, "secret")
    ).toBe(false);
  });

  it("retains only an allowlisted event type, repository, pull request number, and status", () => {
    expect(
      normalizeGitHubWebhook("check_run", {
        action: "completed",
        repository: { full_name: "owner/project" },
        check_run: {
          conclusion: "failure",
          pull_requests: [{ number: 42 }],
          output: { title: "private details" },
        },
      })
    ).toEqual({
      workflowName: "github.check_run.completed|owner/project#42",
      status: "failure",
    });
  });

  it("ignores unsupported events and malformed entities", () => {
    expect(normalizeGitHubWebhook("issues", { action: "opened" })).toBeNull();
    expect(
      normalizeGitHubWebhook("pull_request", {
        action: "opened",
        repository: { full_name: "owner/project" },
        pull_request: { number: 0 },
      })
    ).toBeNull();
  });

  it("sets a bounded webhook body limit", () => {
    expect(maxGitHubPayloadBytes()).toBe(256 * 1024);
  });
});
