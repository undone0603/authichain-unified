# passport-demo

The live sales demo behind `https://passport-demo.undone-k.workers.dev/`
(also `/passport` and `/demo`). It renders a single Digital Product Passport
from query parameters, so one deployment serves every prospect:

| Param     | Meaning                                | Default                               |
| --------- | -------------------------------------- | ------------------------------------- |
| `b`       | brand                                  | `Copper & Rye Distilling Co.`         |
| `p`       | product                                | `Huron Reserve — Single Barrel Rye`   |
| `t`       | type / format line                     | `Small-batch rye whiskey · 750ml`     |
| `o`       | origin                                 | `Traverse City, Michigan`             |
| `d`       | release date                           | `October 2026`                        |
| `x`       | batch id                               | `HR-14-2026`                          |
| `c1`–`c4` | chapter titles                         | `I — The Field` … `IV — The Moment`   |
| `s1`–`s4` | chapter text (`*word*` renders italic) | see source                            |
| `s`       | fallback for `s4`                      | —                                     |
| `m1`–`m4` | milestone labels                       | `Origin` `Craft` `Release` `Verified` |
| `qr`      | override the art-QR image              | `/qr.png`                             |

Routes: `/`, `/passport`, `/demo` (HTML) · `/qr.png`, `/authichain-qr.png`
(inlined JPEGs) · `/health`.

## Why this file exists

This worker was deployed without a source of record — it existed only as a
live Cloudflare script, in none of the other 43 `workers/` directories. This
directory is that source, recovered from the deployed script, plus the
hardening described below.

## The render-script hardening

The original render script addressed elements directly:

```js
document.getElementById("ck" + (i + 1)).textContent = ti;
```

Every one of those is a single point of failure. Because the whole render is
one linear IIFE, a _single_ missing element throws
`Cannot set properties of null (setting 'textContent')` and aborts the rest of
the function — so a page with one missing id renders with **every field after
that point blank**, while the markup above it still looks fine. Verified
against the recovered source with `#ck1` removed:

```
ORIGINAL   pageerror: Cannot set properties of null (setting 'textContent')
           brand=""  product=""  batch=""  proof=""  mark=""
HARDENED   pageerror: (none)
           brand="Copper & Rye Distilling Co."  …  mark="CA"
```

The hardened script routes every write through null-safe `setText(id, val)` /
`setHTML(id, val)` helpers that log `[passport] missing element #<id>` and
carry on, and wraps the whole body in `try/catch` that reports via
`console.error`. A missing element now costs one field instead of the page.

Output is otherwise unchanged: the hardened and original pages were rendered
side by side in Chromium across 10 parameter cases (defaults, per-prospect
params, empty/symbol/unicode/emoji/300-char brands, `*italic*` markup, blank
milestones) and produced byte-identical `innerHTML` for all 22 rendered ids,
with zero console errors on both.

## `em()` fix

The recovered `em()` helper used `.replace(/\*(.+?)\*/g, '<i>$1</i>')` — a
literal, valid form with no undefined identifiers. Despite that, the live
branch-preview deploy threw `ReferenceError: g is not defined` inside `em()`
on every page load, aborting the render right after the first story chapter
(matching a live screenshot: chapter 1's title rendered, everything after it —
brand, batch, date, origin, proof ID, QR image — stayed blank, even with the
null-safe hardening above in place, since each of those fields never got a
chance to run). The exact mechanism producing that error from this exact
source was never identified — the deployed artifact did not match this file's
content, and there was no way to inspect the live build environment further —
so rather than chase the anomaly, `em()` was rewritten to remove the entire
class of bug: it no longer calls `.replace()` with a literal `$1` or a named
capture-group callback parameter at all. It splits the string on `*` and pairs
segments manually. Confirmed fixed live: the branch-preview deploy running
this version renders every field correctly, verified via browser console
(no errors) after the change, versus the reproducible failure before it.

**The mechanism has since been identified — see "The backslash trap" below.**
The `em()` rewrite was a correct fix for the symptom, but the cause was not the
`.replace()` call; it was that a single backslash cannot survive inside `HTML`.

## The backslash trap

**This whole page lives inside a JavaScript template literal** (`const HTML = \`…\``),
so every backslash in it is consumed when that literal is evaluated. What the
worker sends to the browser is not what the source file reads like:

| in the source file          | what the browser receives |
| --------------------------- | ------------------------- |
| `split(/\s+/)`              | `split(/s+/)`             |
| `.replace(/\*(.+?)\*/g, …)` | `.replace(/*(.+?)*/g, …)` |

That second row is the original bug, exactly: `/*` opens a block comment, which
swallows everything to the next `*/` and leaves a bare `g` where an argument
should be — hence `ReferenceError: g is not defined`, thrown inside `em()`, on
every page load. Nothing about the deployment was anomalous and the deployed
artifact did match this file; the template literal simply does not preserve
backslashes.

The same trap silently corrupted the monogram for two months: `split(/\s+/)`
emitted as `split(/s+/)` splits a brand name **on the letter "s"**, so
_Coppercraft Distillery_ rendered `CT` and _Iron Fish Distillery_ rendered `IH`.
No error, no console output — just a quietly wrong initial on a page being sent
to prospects.

**The rule: inside `HTML`, write `\\` for every backslash the browser must
receive.** `split(/\\s+/)` in this file is correct and deliberate; `split(/\s+/)`
is a bug.

**How to check.** Never verify by extracting the text of the literal from this
file — that reads the _source_, in which the backslashes are still present, and
will pass while production is broken. Verify against what `fetch()` actually
returns:

```js
const html = await worker.fetch(new Request("https://x/")).then(r => r.text());
// assert against `html`, not against the template literal's source text
```

Any test that slices this file between backticks is testing a string the browser
never sees.

## QR art (`/qr.png`)

Redesigned for two goals that turned out to be in tension: on-brand and
actually scannable. Several visually striking references (dark background,
light/inverted modules — the "galactic," "neon," dark-metal style of AI QR
art) were tested and **do not reliably decode**: standard QR readers (zbar,
OpenCV's `QRCodeDetector`) require dark modules on a light background, and an
inverted-polarity code that looks structurally identical fails both, even
though some phone camera apps are lenient enough to read it. That's not a risk
worth taking on a real prospect's phone.

The shipped design instead keeps the polarity standard readers require, and
gets the "premium" look from color and texture that doesn't touch contrast:

- Solid black finder squares (untouched — these are load-bearing for
  detection) and dot-style data modules, each dot radius tuned to the largest
  value that still reads reliably (swept 0.34–0.50× the module box; anything
  below ~0.46× started failing).
- A subtle green→ink gradient across the dots (hue varies by position; every
  dot stays dark enough to keep the light/dark threshold readers rely on).
- A center crest (gold ring, laurel ticks, brand initials — original
  geometry, no third-party marks) over a reserved zone sized well inside the
  tested-safe margin: verified scannable up to 36% center coverage; shipped
  at 20% for margin.
- Fine paper-grain background texture and a corner vignette, both low
  amplitude — nowhere near dark enough to be mistaken for a module.

Every variant above was verified with **two independent decoders** (`pyzbar`
and OpenCV's `QRCodeDetector`) before being accepted, including a byte-level
round-trip check against the exact base64 payload embedded in this file (not
just the source PNG). `/authichain-qr.png` (`QR_BRAND`) was left as-is —
out of scope for this pass.

## Branded links assert nothing

Copper & Rye Distilling Co. is a fictional distillery invented for this demo, so
its story specifics — "Barrel No. 14", "212 bottles, each numbered and signed by
the distiller", batch `HR-14-2026`, Traverse City — are safe to state while the
page is showing Copper & Rye.

They are not safe under someone else's name. `?b=Iron%20Fish%20Distillery` alone
used to render all of those beneath _Iron Fish Distillery_, so a prospect opening
a half-filled outreach link saw invented facts about their own product.

So every fallback is now conditional on `b`:

| field   | no `b` (canonical demo)               | `b` set (a branded link)      |
| ------- | ------------------------------------- | ----------------------------- |
| product | `Huron Reserve — Single Barrel Rye`   | `Your product name`           |
| type    | `Small-batch rye whiskey · 750ml`     | `Product type · size`         |
| origin  | `Traverse City, Michigan`             | `Your town, your state`       |
| date    | `October 2026`                        | `Release date`                |
| batch   | `HR-14-2026`                          | `BATCH-0000`                  |
| titles  | `I — The Field`, `II — The Barrel`, … | `I — Origin`, `II — Craft`, … |
| story   | the Copper & Rye specifics            | copy that names no fact       |

An incomplete branded link now reads as a visibly unfilled template rather than a
false claim. Supplying `p`, `t`, `o`, `d`, `x` and `s1`–`s4` overrides every
placeholder, which is what a real prospect link should do.

Verified in Chromium against this file: the canonical demo still renders "Barrel
No. 14" and "212 bottles"; `?b=Iron%20Fish%20Distillery` leaks none of the eight
Copper & Rye specifics; supplied copy is used verbatim. Zero console errors in
all three cases.

## Known gap

`/qr.png` and `/authichain-qr.png` serve JPEG bytes under `.png` names. Browsers
sniff the `content-type` header so it renders, but the names are misleading and
should be corrected when the images move out of source.
