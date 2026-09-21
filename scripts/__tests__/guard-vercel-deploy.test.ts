import { describe, expect, it } from "vitest";
import { scanWorkflowText } from "../guard-vercel-deploy.mjs";

describe("scanWorkflowText", () => {
  it("allows Cloudflare wrangler deploy", () => {
    expect(
      scanWorkflowText(
        "deploy-workers.yml",
        "run: npx wrangler deploy --minify --config wrangler.toml"
      )
    ).toEqual([]);
  });

  it("rejects vercel deploy --prod", () => {
    const hits = scanWorkflowText(
      "deploy-vercel.yml",
      "run: vercel deploy --prod --yes"
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it("rejects vercel-action", () => {
    const hits = scanWorkflowText(
      "preview.yml",
      "uses: amondnet/vercel-action@v25"
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it("ignores comments that mention Vercel deploy", () => {
    expect(
      scanWorkflowText(
        "notes.yml",
        "# never run vercel deploy --prod\nrun: echo ok\n"
      )
    ).toEqual([]);
  });
});
