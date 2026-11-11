# QRON Studio

Constraint-driven QR artwork that stays a standard QR code. QRON Studio does
not decorate a finished code, and it does not ask an image model to
approximate one. It starts from a mathematically valid symbol and asks:

> Which valid QR configuration of this payload most closely resembles the
> artwork we want?

Formally, for payload `p`, its set of valid encodings `Q(p)`, target artwork
`A`, renderer `R` and a visual distance `D`:

```
q* = argmin  D( R(q), A )
     q ∈ Q(p)
```

**The release gate:** a design ships only if every *required* capture
condition decodes to the **exact** payload on **every** decoder. Visual
quality never counts as a pass.

## Pipeline

```
payload (URL / GS1 Digital Link / AuthiChain resolve URL)
  │
  ▼ encoder.ts ─ own ISO/IEC 18004 encoder, internals exposed
  │   version + ECL choice, Reed–Solomon, interleaving, all 8 masks,
  │   protected-module map (finders, timing, alignment, format, version),
  │   codeword-bit → module map, per-block correction capacity
  ▼ synthesis.ts ─ inverse synthesis
  │   free bits after the terminator; GF(2) elimination pins them to the
  │   artwork; every mask tried; optional, accounted error budget
  ▼ targets.ts ─ artwork: 9 seeded procedural motifs or a supplied image
  ▼ render.ts ─ raster (validated) + SVG (re-validated) renderers
  │   square · liquid · dot · diamond · halftone (multiscale)
  ▼ validate.ts + perturb.ts ─ scanner-in-the-loop
  │   jsQR + ZXing, exact-payload match, 9 capture conditions
  ▼ studio.ts ─ search, dedupe, accept/reject, rank
  ▼ scripts/qron-studio.ts ─ SVG/PNG export, report, gallery, provenance
```

## The five techniques, as built

| Technique | Where | What it actually does |
| --- | --- | --- |
| Artistic mask optimization | `synthesizeAllMasks` | Runs synthesis under all 8 masks and keeps the best weighted agreement. Per-mask scores go in the report. The format information stays valid because it is written for the chosen mask. |
| Payload-aware composition | `synthesis.ts` | Header, payload and terminator are fixed. Every data bit after the terminator is free, because conforming decoders stop at the terminator. Those bits are chosen for the artwork, and the decoded string is still exactly the payload. This departs from the spec's pad codewords (see *Limits*; `strictPadding` turns it off). Smaller modes (numeric, alphanumeric) leave more free bits. |
| Error-correction-aware artwork | `synthesize({ errorBudget })` | Reed–Solomon is GF(2)-linear, so each module is an affine function of its block's free bits. Free bits are pinned in priority order with no ECC spent. Further flips are optional, counted per block in *damaged codewords*, and capped at a fraction of that block's correction capacity (net of misdecode protection). |
| Multiscale visual design | `render.ts` halftone | A scanner samples module centres. Only a centre square carries the module value, tone-mapped from the artwork's own colour. The periphery shows the artwork, blended toward the module tone just enough to survive blur. Function patterns are never halftoned. |
| Scanner-in-the-loop generation | `validate.ts` | Every candidate is captured and decoded under the conditions below. Failures are rejected and their reasons logged. |

### Capture conditions

| Condition | Required |
| --- | --- |
| Clean render | yes |
| Small print / distance (≈3 px per module) | yes |
| Defocus blur (σ = 0.3 module) | yes |
| Rotated 17° | yes |
| Perspective tilt (keystone 14%) | yes |
| Uneven light (55% falloff + shadow band) | yes |
| Sensor noise (σ = 14) | scored |
| Faded print (contrast 70→190) | scored |
| Combined: blur + rotation + falloff + noise | scored |

Decoders: **jsQR** and **ZXing** (`@zxing/library`). These are independent
implementations. A read passes only if the decoded text equals the payload
exactly. OpenCV is not wired in yet. Adding it is one `QrDecoder` object
(`{ name, decode(gray) }`).

## Ranking

```
visual    = 0.5 · agreement + 0.5 · fidelity
composite = 0.5 · visual    + 0.5 · robustness
```

- **agreement:** weighted share of data-region modules that match the
  artwork.
- **fidelity:** 1 − mean |render − target| at 48 × 48 viewing scale.
- **robustness:** share of (condition × decoder) reads that return the
  exact payload, optional conditions included.

These are measurable proxies, not a judgement of beauty. The weights live
in `SCORE_WEIGHTS`.

## Usage

```bash
pnpm qron:studio --payload "https://authichain.com/qron/r/<object-id>" --count 100
pnpm qron:studio --payload "<url>" --image art.png --shapes halftone,dot --count 20
```

Output goes to `out/qron-studio/<payload-hash>-s<seed>/`, which is
gitignored:

- `designs/NNN-<id>.png`: the exact raster that was validated.
- `designs/NNN-<id>.svg`: re-rasterized in headless Chromium and run through
  the full gate. Only a **verified** SVG is exported. Failed or skipped
  verification withholds the SVG; the validated PNG still ships.
  `--no-verify-svg`, missing Playwright, or a Chromium launch failure therefore
  produce PNG-only exports. A rerun removes an existing SVG at the same
  export path when it is withheld, and `svgWithheld` counts failures and skips.
  Set `QRON_CHROMIUM_PATH` if Playwright's browser download does not match.
- `report.json` / `report.md`: per-design parameters, synthesis metrics,
  the per-condition × per-decoder matrix, scores and rejection reasons.
- `provenance.json`: one `AuthiChain QRON Provenance v0` record per design
  (payload hash, params, matrix/PNG/SVG sha256, validation summary) plus a
  manifest hash. It is **not anchored**. Anchoring goes through the existing
  ledger path and is a separate, deliberate step.
- `index.html`: a gallery.

The run is a pure function of `(options, seed)`. Only timestamps differ
between reruns.

## Limits worth knowing

- **Art bits after the terminator are a deliberate deviation from the
  encoding procedure.** ISO/IEC 18004 tells encoders to fill that region
  with alternating 0xEC/0x11 pad codewords. Decoders stop at the
  terminator, so the decoded payload is unchanged, and the gate confirms it
  on both decoders for every design. A reader that checks pad codewords
  would still object. For such a target, use `strictPadding` /
  `--strict-padding`. The pads stay spec-exact, and only the mask choice
  and the accounted error budget shape the art. Expect less resemblance.
- ZXing's detector (0.21.3) misses at least one fully conformant symbol
  (v9-H, mask 7, alphanumeric). It decodes with `PURE_BARCODE`. See
  `encoder.test.ts`. Decoders differ, which is why the gate uses more than
  one.
- Fine-grained photographs do not survive module resolution well. Bold
  shapes and strong tonal regions read best.

