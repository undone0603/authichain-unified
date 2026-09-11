@AGENTS.md

<!-- Everything below is ours. Next.js hosts its managed agent-rules block in
     AGENTS.md, and generate-agent-files.js skips this file entirely once it
     does (see the claudeMd: 'skipped' branch), so additions here survive
     `next dev`. -->

@docs/misc/CLAUDE.md

## Project guide

`docs/misc/CLAUDE.md` is the AuthiChain project guide — Truth Layer principles,
essential commands, architecture. It was written at the repo root and moved to
`docs/misc/` in the 2026-08-31 consolidation (b3f82a3), after which nothing
referenced it. Between then and 2026-09-11 the only instructions loading at the
root were Next.js framework notes, so the project's own guidance was never
reaching an agent session. The import above reconnects it.

## Working notes

- **Genetics passports** — `docs/strategy/strainchain-genetics-passport.md`
  carries the numbered design decisions and the pricing ruling. Read it before
  changing `src/lib/genetics.ts`, the `/genetics` routes, or anything about how
  provenance is displayed.
- **Totals are derived, never transcribed.** Every THCV/THC figure on a passport
  is recomputed from the raw panel at render time. Do not add a code path that
  displays a stored total.
- **`src/lib/plans.ts` is the source of truth for anything that charges.**
  `shared/pricing.ts` is a Stripe plan-detection reference holding test-mode
  IDs, despite what it used to call itself.
- **Chrome colours and data colours are not interchangeable.** The botanical
  accents in `src/app/genetics/genetics.css` fail the chroma floor as data
  marks; charts use the validated `--viz-*` slots.
