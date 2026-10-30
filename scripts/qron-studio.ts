/**
 * QRON Studio CLI — generate, validate, rank and export scannable QR art.
 *
 *   pnpm qron:studio --payload https://authichain.com/qron/r/<object-id>
 *
 * Options:
 *   --payload <text>        required; the exact string every design must decode to
 *   --count <n>             accepted designs to produce (default 100)
 *   --seed <n>              deterministic seed (default 1)
 *   --out <dir>             output directory (default out/qron-studio/<hash>-s<seed>)
 *   --image <png|jpg>       target artwork instead of procedural motifs
 *   --ecl M,Q               error-correction levels to explore
 *   --budgets 0,0,0.25      error-budget fractions to sample from
 *   --strict-padding        keep spec 0xEC/0x11 pad codewords (no art bits after the terminator)
 *   --span <n>              versions explored above the minimum (default 3)
 *   --ppm <n>               pixels per module of the validated raster (default 10)
 *   --max-candidates <n>    candidate cap (default 3 × count)
 *   --motifs a,b            procedural motifs to cycle through
 *   --shapes a,b            module shapes (square,liquid,dot,diamond,halftone)
 *   --no-verify-svg         withhold SVGs; export validated PNGs only
 *                           (set QRON_CHROMIUM_PATH to use a specific Chromium binary)
 *   --quiet                 no per-design progress lines
 *
 * Exit code 0 when `count` designs were accepted, 2 when the candidate cap
 * ran out first. Every exported design passed every required condition on
 * every decoder with the exact payload. The release gate is documented in
 * src/lib/qron-studio/README.md.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  designSummary,
  imageTarget,
  MOTIF_IDS,
  renderRaster,
  renderSvg,
  runStudio,
  SCORE_WEIGHTS,
  SHAPE_MENU,
  STUDIO_VERSION,
  validateRaster,
  type DesignRecord,
  type Ecl,
  type Raster,
  type TargetField,
} from "../src/lib/qron-studio";
import { encodePng } from "../src/lib/qron-studio/png";

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const list = (v: string | boolean | undefined) =>
  typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
const int = (v: string | boolean | undefined, dflt: number) => (typeof v === "string" ? parseInt(v, 10) : dflt);

async function loadImage(file: string): Promise<TargetField> {
  const { Jimp } = await import("jimp");
  const img = await Jimp.read(file);
  if (img.bitmap.width > 512) img.resize({ w: 512 });
  const { data, width, height } = img.bitmap;
  return imageTarget(data, width, height, `image:${path.basename(file)}`);
}

type SvgCheck = { status: "verified" | "failed" | "skipped"; detail?: string };

type SvgVerifier =
  | { kind: "off"; reason: string }
  | {
      kind: "on";
      check(svg: string, px: number, payload: string, ppm: number): Promise<SvgCheck>;
      close(): Promise<void>;
    };

/** Re-scans each SVG as Chromium rasterizes it, with the full condition set. */
async function makeSvgVerifier(enabled: boolean): Promise<SvgVerifier> {
  if (!enabled) return { kind: "off", reason: "disabled (--no-verify-svg)" };
  const req = createRequire(import.meta.url);
  let chromium: { launch(opts?: { executablePath?: string }): Promise<any> } | null = null;
  for (const mod of ["playwright", "playwright-core"]) {
    try {
      chromium = req(mod).chromium;
      break;
    } catch {
      // try the next one
    }
  }
  if (!chromium) return { kind: "off", reason: "playwright not installed" };
  let browser: any;
  try {
    // QRON_CHROMIUM_PATH points at a local Chromium when Playwright's own
    // browser download does not match the installed Playwright version.
    const executablePath = process.env.QRON_CHROMIUM_PATH || undefined;
    browser = await chromium.launch(executablePath ? { executablePath } : undefined);
  } catch (err) {
    return { kind: "off", reason: `chromium launch failed: ${(err as Error).message.split("\n")[0]}` };
  }
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const { Jimp } = await import("jimp");
  return {
    kind: "on",
    async check(svg, px, payload, ppm) {
      await page.setViewportSize({ width: px, height: px });
      await page.setContent(
        `<html><body style="margin:0;background:#fff">${svg.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`)}</body></html>`
      );
      const shot: Buffer = await page.screenshot({ clip: { x: 0, y: 0, width: px, height: px } });
      const img = await Jimp.read(shot);
      const raster: Raster = {
        width: img.bitmap.width,
        height: img.bitmap.height,
        data: new Uint8ClampedArray(img.bitmap.data),
      };
      const report = validateRaster(raster, payload, { ppm, failFast: true });
      return report.pass
        ? { status: "verified" }
        : { status: "failed", detail: report.failures.join("; ") };
    },
    close: () => browser.close(),
  };
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = typeof args.payload === "string" ? args.payload : "";
  if (!payload) {
    console.error("qron-studio: --payload is required (the exact string every design must decode to)");
    process.exitCode = 64;
    return;
  }
  const count = int(args.count, 100);
  const seed = int(args.seed, 1);
  const ppm = int(args.ppm, 10);
  const payloadHash = sha256(payload);
  const outDir = typeof args.out === "string" ? args.out : path.join("out", "qron-studio", `${payloadHash.slice(0, 10)}-s${seed}`);
  const shapeFilter = list(args.shapes);
  const image = typeof args.image === "string" ? await loadImage(args.image) : null;
  const options = {
    count,
    seed,
    ppm,
    maxCandidates: int(args["max-candidates"], count * 3),
    ecls: (list(args.ecl) as Ecl[] | undefined) ?? (["M", "Q"] as Ecl[]),
    errorBudgets: list(args.budgets)?.map(Number) ?? [0, 0, 0.25],
    versionSpan: int(args.span, 3),
    strictPadding: !!args["strict-padding"],
    motifs: list(args.motifs) ?? MOTIF_IDS,
    shapes: shapeFilter ? SHAPE_MENU.filter((s) => shapeFilter.includes(s.shape)) : SHAPE_MENU,
  };

  const started = Date.now();
  console.log(`${STUDIO_VERSION}: ${count} designs for ${JSON.stringify(payload)} (seed ${seed})`);
  const run = runStudio({
    payload,
    ...options,
    image,
    onProgress: args.quiet
      ? undefined
      : ({ candidate, accepted, design }) => {
          const p = design.params;
          console.log(
            `  #${String(candidate).padStart(3)} ${design.status === "accepted" ? "ACCEPT" : "reject"} ` +
              `v${p.version}-${p.ecl} m${p.mask} ${p.target.id}/${p.shape}/${p.finder}/${p.palette} ` +
              `agree=${design.synthesis.agreement.toFixed(2)} robust=${design.scores.robustness.toFixed(2)}` +
              (design.rejection ? `  (${design.rejection})` : "") +
              `  [${accepted}/${count}]`
          );
        },
  });

  const designsDir = path.join(outDir, "designs");
  mkdirSync(designsDir, { recursive: true });
  const verifier = await makeSvgVerifier(!args["no-verify-svg"]);
  const svgSkipReason = verifier.kind === "off" ? verifier.reason : null;
  const createdAt = new Date().toISOString();

  type Exported = { design: DesignRecord; png: string; svg: string | null; pngSha256: string; svgSha256: string | null; matrixSha256: string; svgCheck: SvgCheck };
  const exported: Exported[] = [];
  for (const d of run.accepted) {
    const stem = `${String(d.rank).padStart(3, "0")}-${d.id}`;
    const png = encodePng(d.raster!);
    const pngFile = `designs/${stem}.png`;
    writeFileSync(path.join(outDir, pngFile), png);

    let artHref: string | undefined;
    if (d.style.shape === "halftone") {
      const art = renderRaster(d.symbol, d.style, { ppm, field: d.field, artOnly: true });
      artHref = `data:image/png;base64,${encodePng(art).toString("base64")}`;
    }
    const svg = renderSvg(d.symbol, d.style, {
      field: d.field,
      artHref,
      title: `QRON ${d.id}`,
      pixelSize: d.raster!.width,
    });
    let svgCheck: SvgCheck = { status: "skipped", detail: svgSkipReason ?? undefined };
    if (verifier.kind === "on") svgCheck = await verifier.check(svg, d.raster!.width, payload, ppm);
    // Only a verified SVG passes the release gate. Skipping is not a pass.
    const svgCandidate = `designs/${stem}.svg`;
    let svgFile: string | null = null;
    if (svgCheck.status === "verified") {
      svgFile = svgCandidate;
      writeFileSync(path.join(outDir, svgFile), svg);
    } else {
      // A rerun must not leave a previous copy of this withheld export on disk.
      rmSync(path.join(outDir, svgCandidate), { force: true });
    }
    exported.push({
      design: d,
      png: pngFile,
      svg: svgFile,
      pngSha256: sha256(png),
      svgSha256: svgFile ? sha256(svg) : null,
      matrixSha256: sha256(d.symbol.modules),
      svgCheck,
    });
  }
  if (verifier.kind === "on") await verifier.close();

  const provenance = exported.map((e) => ({
    schema: "AuthiChain QRON Provenance v0",
    object_id: e.design.id,
    payload,
    payload_sha256: payloadHash,
    generator: STUDIO_VERSION,
    seed,
    params: e.design.params,
    matrix_sha256: e.matrixSha256,
    png_sha256: e.pngSha256,
    svg_sha256: e.svgSha256,
    validation: {
      pass: e.design.validation.pass,
      robustness: e.design.validation.robustness,
      decoders: e.design.validation.decoders,
      conditions: e.design.validation.results.map((r) => r.id),
      svg: e.svgCheck.status,
    },
    created_at: createdAt,
  }));
  const manifestSha256 = sha256(JSON.stringify(provenance));
  writeFileSync(
    path.join(outDir, "provenance.json"),
    JSON.stringify({ manifest_sha256: manifestSha256, anchored: false, records: provenance }, null, 2)
  );

  const rejectionCounts: Record<string, number> = {};
  for (const r of run.rejected) {
    for (const f of (r.rejection ?? "").split("; ").filter(Boolean)) {
      rejectionCounts[f] = (rejectionCounts[f] ?? 0) + 1;
    }
  }
  const svgWithheld = exported.filter((e) => e.svgCheck.status !== "verified").length;
  const svgVerified = exported.filter((e) => e.svgCheck.status === "verified").length;
  const summary = {
    requested: count,
    candidates: run.candidates,
    accepted: run.accepted.length,
    rejected: run.rejected.length,
    acceptanceRate: run.candidates ? run.accepted.length / run.candidates : 0,
    svgVerified,
    svgWithheld,
    svgCheck: svgSkipReason ? `skipped: ${svgSkipReason}` : "chromium",
    elapsedSeconds: Math.round((Date.now() - started) / 100) / 10,
  };
  const report = {
    generator: STUDIO_VERSION,
    createdAt,
    payload,
    payloadSha256: payloadHash,
    seed,
    options: { ...options, image: image?.id ?? null },
    scoreWeights: SCORE_WEIGHTS,
    conditions: run.conditions,
    decoders: run.decoders,
    summary,
    rejectionCounts,
    manifestSha256,
    designs: exported.map((e) => ({
      ...designSummary(e.design),
      files: { png: e.png, svg: e.svg },
      hashes: { png: e.pngSha256, svg: e.svgSha256, matrix: e.matrixSha256 },
      svgCheck: e.svgCheck,
    })),
    rejected: run.rejected.map((d) => {
      const { matrix: _matrix, ...rest } = designSummary(d);
      return rest;
    }),
  };
  writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const md: string[] = [
    `# QRON Studio run — ${run.accepted.length}/${count} accepted`,
    "",
    `- **Payload:** \`${payload}\` (sha256 \`${payloadHash.slice(0, 16)}…\`)`,
    `- **Generator:** ${STUDIO_VERSION}, seed ${seed}, ${ppm} px/module`,
    `- **Candidates tried:** ${run.candidates} · accepted ${run.accepted.length} · rejected ${run.rejected.length} (acceptance ${pct(summary.acceptanceRate)})`,
    `- **Decoders:** ${run.decoders.join(", ")} · **SVG re-scan:** ${summary.svgCheck} (${svgVerified} verified, ${svgWithheld} withheld)`,
    `- **Manifest sha256:** \`${manifestSha256}\` (not anchored)`,
    "",
    "## Release gate",
    "",
    "A design is released only if every **required** condition decodes to the exact payload on **every** decoder.",
    "",
    "| Condition | Required |",
    "| --- | --- |",
    ...run.conditions.map((c) => `| ${c.label} | ${c.required ? "yes" : "no (scored)"} |`),
    "",
    "## Ranked designs",
    "",
    "| Rank | Design | Version | Mask | Target | Shape | Finder | Palette | Agreement | Fidelity | Robustness | Composite | SVG |",
    "| ---: | --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...exported.map(({ design: d, png, svgCheck }) =>
      [
        "",
        d.rank,
        `[${d.id}](${png})`,
        `${d.params.version}-${d.params.ecl}${d.params.errorBudget ? ` (budget ${d.params.errorBudget})` : ""}`,
        d.params.mask,
        d.params.target.id,
        d.params.shape,
        d.params.finder,
        d.params.palette,
        d.synthesis.agreement.toFixed(3),
        d.scores.fidelity.toFixed(3),
        d.scores.robustness.toFixed(3),
        d.scores.composite.toFixed(3),
        svgCheck.status,
        "",
      ].join(" | ").trim()
    ),
    "",
    "## Rejections (required condition / decoder)",
    "",
    ...(Object.keys(rejectionCounts).length
      ? Object.entries(rejectionCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `- ${k}: ${n}`)
      : ["- none"]),
    "",
  ];
  writeFileSync(path.join(outDir, "report.md"), md.join("\n"));

  const cards = exported
    .map(({ design: d, png }) => {
      const tag = `${d.params.target.id} · ${d.params.shape} · ${d.params.palette}`;
      return `<figure><img src="${png}" alt="${htmlEscape(d.id)}" loading="lazy"><figcaption><b>#${d.rank}</b> ${htmlEscape(tag)}<br>v${d.params.version}-${d.params.ecl} · mask ${d.params.mask} · robust ${pct(d.scores.robustness)}</figcaption></figure>`;
    })
    .join("\n");
  writeFileSync(
    path.join(outDir, "index.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QRON Studio run</title><style>body{font:14px system-ui,sans-serif;margin:24px;background:#faf8f4;color:#1d1b18}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}figure{margin:0;background:#fff;border:1px solid #e6e0d6;border-radius:8px;padding:8px}img{width:100%;height:auto;display:block}figcaption{font-size:12px;margin-top:6px;color:#4a453e}</style></head><body><h1>QRON Studio — ${run.accepted.length} validated designs</h1><p>Every design below decodes to <code>${htmlEscape(payload)}</code> on ${run.decoders.join(" and ")} under all required capture conditions. Full report: <a href="report.md">report.md</a> · <a href="report.json">report.json</a> · <a href="provenance.json">provenance.json</a></p><main>${cards}</main></body></html>`
  );

  console.log(
    `\n${run.accepted.length}/${count} accepted from ${run.candidates} candidates ` +
      `(${pct(summary.acceptanceRate)}), SVG re-scan: ${summary.svgCheck} ` +
      `(${svgVerified} verified, ${svgWithheld} withheld) in ${summary.elapsedSeconds}s\n→ ${outDir}`
  );
  if (run.accepted.length < count) process.exitCode = 2;
}

await main();

