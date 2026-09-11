# Michigan distillery outreach links

One `passport-demo` link per prospect for the manual outreach cycle, built
2026-09-11. **Nothing here has been sent.**

## The links

Each carries only the prospect's name. Every other field falls back to a visible
placeholder, so the page reads as a template built for them rather than a claim
about them.

| Prospect                   | Mark | Link                                                                             |
| -------------------------- | ---- | -------------------------------------------------------------------------------- |
| Coppercraft Distillery     | CD   | `https://passport-demo.undone-k.workers.dev/?b=Coppercraft%20Distillery`         |
| Michigrain Distillery      | MD   | `https://passport-demo.undone-k.workers.dev/?b=Michigrain%20Distillery`          |
| Iron Fish Distillery       | IF   | `https://passport-demo.undone-k.workers.dev/?b=Iron%20Fish%20Distillery`         |
| Eastern Market Brewing Co. | EM   | `https://passport-demo.undone-k.workers.dev/?b=Eastern%20Market%20Brewing%20Co.` |
| Off the Chain Brewstillery | OT   | `https://passport-demo.undone-k.workers.dev/?b=Off%20the%20Chain%20Brewstillery` |
| Detroit City Distillery    | DC   | `https://passport-demo.undone-k.workers.dev/?b=Detroit%20City%20Distillery`      |
| Valentine Distilling Co.   | VD   | `https://passport-demo.undone-k.workers.dev/?b=Valentine%20Distilling%20Co.`     |
| Long Road Distillers       | LR   | `https://passport-demo.undone-k.workers.dev/?b=Long%20Road%20Distillers`         |

Verified in Chromium against the deployed worker source: all eight render the
prospect's name, derive the monogram above, and leak **none** of the eight
Copper & Rye specifics. Zero console errors. A branded link shows
`Your product name` / `Your town, your state` / `BATCH-0000`.

## Why no town is set

The plan called for name **and town**. Town was dropped, deliberately.

The rule this whole passport change exists to enforce is that nothing unverified
gets printed under a real company's name. Primary sources could not be reached —
the network egress proxy blocks the distilleries' own websites — so the only
available sources were search snippets, and they were not good enough:

- **Coppercraft** — returned as Saugatuck, against a recollection of Holland.
- **Valentine** — one snippet gave Clinton, Ferndale _and_ Detroit in the same
  breath.

Two of the first four checked were ambiguous or contradictory. Printing "Holland,
Michigan" on a passport sent to a distillery that moved to Saugatuck is a small
error that lands exactly where it hurts — on the page whose entire pitch is that
it only states verifiable things.

So `o=` is omitted and the page shows `Your town, your state`, which is honest.

**To add towns**, append to any link:

```
&o=Thompsonville,%20Michigan
```

This takes seconds for someone who knows these prospects, and it is the right
person to do it. The same applies to `p` (product), `t` (type · size),
`d` (release date), `x` (batch) and `s1`–`s4` (the four story chapters) — any
supplied value overrides its placeholder.

## Before sending: playbook precondition

`.claude/skills/manual-outreach-playbook/SKILL.md` states the cycle applies only
when there is **real data, a verified contact, and an existing relationship**, and
that an address must be Apollo-verified or published by the company itself —
"never a pattern guess".

For these eight, none of the three appears to hold. That does not block building
links, but it does bear on sending: a pattern-guessed address (`info@`,
`hello@`) is what the deliverability runbook is written against. Verify each
contact before any of these goes out.
