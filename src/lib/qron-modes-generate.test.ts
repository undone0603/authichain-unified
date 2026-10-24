import { describe, expect, it, vi } from "vitest";
import { handleGeneratePost } from "./generate-api";
import {
  MODE_DISPLAY_NAMES,
  QRON_MODES,
  applyMode,
  modeGenerateUrl,
  parseSelectableMode,
} from "./qron-modes";
import { QRON_MODE_FOOTER_TEXT, handleQronResolve, qronModeFooterHtml } from "./qron-resolve";

function run(body: Record<string, unknown>) {
  const generateImage = vi.fn(async () => ({ imageUrl: "https://img.example/x.png" }));
  const checkCredit = vi.fn(async () => ({ ok: true, remaining: 10 }));
  const deductCredit = vi.fn(async () => ({ ok: true, remaining: 9 }));
  const logEvent = vi.fn(async () => {});
  const result = handleGeneratePost({
    body: { targetUrl: "https://example.com/p", prompt: "gold foil", ...body },
    userId: "u1",
    checkCredit,
    deductCredit,
    generateImage,
    logEvent,
  });
  return { result, generateImage, deductCredit, logEvent };
}

describe("qron modes: display names", () => {
  it("names come from the single MODE_DISPLAY_NAMES constant", () => {
    expect(MODE_DISPLAY_NAMES).toEqual({
      stellar_seal: "Stellar Art",
      batch_verify: "Batch Create",
      limited_drop: "Limited Drop",
    });
    expect(QRON_MODES.stellar_seal.name).toBe(MODE_DISPLAY_NAMES.stellar_seal);
    expect(QRON_MODES.batch_verify.name).toBe(MODE_DISPLAY_NAMES.batch_verify);
    expect(QRON_MODES.limited_drop.name).toBe(MODE_DISPLAY_NAMES.limited_drop);
  });

  it("parses ids and slugs, rejects render modes and junk", () => {
    expect(parseSelectableMode("stellar-art")).toBe("stellar_seal");
    expect(parseSelectableMode("batch_verify")).toBe("batch_verify");
    expect(parseSelectableMode("LIMITED-DROP")).toBe("limited_drop");
    expect(parseSelectableMode("static")).toBeNull();
    expect(parseSelectableMode("living_portal")).toBeNull();
    expect(parseSelectableMode(undefined)).toBeNull();
  });
});

describe("handleGeneratePost with a mode", () => {
  it("valid mode prepends the seed, charges 1 credit, logs both events", async () => {
    const { result, generateImage, deductCredit, logEvent } = run({ mode: "stellar_seal" });
    const r = await result;
    expect(r.status).toBe(200);
    const call = (generateImage.mock.calls[0] as unknown as [{ prompt: string; mode: string }])[0];
    expect(call.prompt).toBe(applyMode("gold foil", "stellar_seal"));
    expect(call.prompt.startsWith(QRON_MODES.stellar_seal.promptSeed)).toBe(true);
    expect(call.mode).toBe("static");
    expect(deductCredit).toHaveBeenCalledTimes(1);
    expect(logEvent.mock.calls.map(c => (c as unknown[])[0])).toEqual(["mode_select", "gen_with_mode"]);
    expect((r.body.qron as Record<string, unknown>).modeId).toBe("stellar_seal");
  });

  it("slug in modeId works too", async () => {
    const { result, generateImage } = run({ modeId: "batch-create" });
    expect((await result).status).toBe(200);
    const call = (generateImage.mock.calls[0] as unknown as [{ prompt: string }])[0];
    expect(call.prompt.startsWith(QRON_MODES.batch_verify.promptSeed)).toBe(true);
  });

  it("invalid mode keeps existing behavior and logs nothing", async () => {
    const { result, generateImage, logEvent, deductCredit } = run({ mode: "bogus" });
    expect((await result).status).toBe(200);
    const call = (generateImage.mock.calls[0] as unknown as [{ prompt: string; mode: string }])[0];
    expect(call.prompt).toBe("gold foil");
    expect(call.mode).toBe("bogus");
    expect(logEvent).not.toHaveBeenCalled();
    expect(deductCredit).toHaveBeenCalledTimes(1);
  });

  it("missing mode keeps existing behavior", async () => {
    const { result, generateImage, logEvent } = run({});
    const r = await result;
    expect(r.status).toBe(200);
    const call = (generateImage.mock.calls[0] as unknown as [{ prompt: string; mode: string }])[0];
    expect(call.prompt).toBe("gold foil");
    expect(call.mode).toBe("static");
    expect(logEvent).not.toHaveBeenCalled();
    expect((r.body.qron as Record<string, unknown>).modeId).toBeUndefined();
  });

  it("a throwing logger never blocks generation", async () => {
    const generateImage = vi.fn(async () => ({ imageUrl: "https://img.example/x.png" }));
    const r = await handleGeneratePost({
      body: { targetUrl: "https://example.com/p", prompt: "x", mode: "limited-drop" },
      userId: "u1",
      checkCredit: async () => ({ ok: true }),
      deductCredit: async () => ({ ok: true }),
      generateImage,
      logEvent: async () => {
        throw new Error("down");
      },
    });
    expect(r.status).toBe(200);
  });
});

describe("resolve page footer", () => {
  it("links /generate?mode=<slug> with UTM tags", () => {
    const html = qronModeFooterHtml("limited_drop");
    expect(html).toContain(QRON_MODE_FOOTER_TEXT);
    expect(QRON_MODE_FOOTER_TEXT).toBe("Create your own Living QR — free to try");
    const href = modeGenerateUrl("limited_drop", { source: "qron", medium: "resolve_footer", campaign: "modes" });
    expect(href).toBe(
      "https://qron.space/generate?mode=limited-drop&utm_source=qron&utm_medium=resolve_footer&utm_campaign=modes",
    );
    expect(html).toContain(href.replace(/&/g, "&amp;"));
  });

  it("no footer without a valid mode", () => {
    expect(qronModeFooterHtml(undefined)).toBe("");
    expect(qronModeFooterHtml("static")).toBe("");
  });

  it("HTML resolve page shows the footer only for mode QRs", async () => {
    const base = {
      object_id: "abc",
      destination_url: "https://example.com/p",
      resolve_url: "https://x/qron/r/abc",
      jws: "",
      kid: "",
      jwks_url: "",
    };
    const req = () => new Request("https://authichain.com/qron/r/abc", { headers: { accept: "text/html" } });
    const withMode = await handleQronResolve(req(), { load: async () => ({ ...base, mode_id: "stellar_seal" }) });
    expect(await withMode!.text()).toContain("mode=stellar-art");
    const without = await handleQronResolve(req(), { load: async () => base });
    expect(await without!.text()).not.toContain(QRON_MODE_FOOTER_TEXT);
  });
});
