# Michigan distillery outreach links

One live AuthiChain intake URL per prospect for the manual outreach cycle.
These replaced the `passport-demo.undone-k.workers.dev/?b=…` placeholders
on 2026-09-20. **Nothing here is a personalized passport claim.**

Live check (HTTP 200 today): `https://authichain.com/onboard` and
`https://strainchain.io/onboard`. `https://strainchain.io/genetics/mendo-love-farms`
was **not** 200 at replacement time, so it is not used. Do not invent domains.

## The links

Each URL is the live AuthiChain onboard form with UTM so a reply can be
attributed to this list. Distilleries are a DPP / authenticity pitch, so the
estate is authichain.com — not StrainChain genetics.

| Prospect                   | Mark | Link                                                                                                      |
| -------------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| Coppercraft Distillery     | CD   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=coppercraft`     |
| Michigrain Distillery      | MD   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=michigrain`      |
| Iron Fish Distillery       | IF   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=iron-fish`       |
| Eastern Market Brewing Co. | EM   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=eastern-market`  |
| Off the Chain Brewstillery | OT   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=off-the-chain`   |
| Detroit City Distillery    | DC   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=detroit-city`    |
| Valentine Distilling Co.   | VD   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=valentine`       |
| Long Road Distillers       | LR   | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=long-road`       |

### Before / after

| | URL |
| --- | --- |
| Before | `https://passport-demo.undone-k.workers.dev/?b=…` (worker demo, not an estate) |
| After | `https://authichain.com/onboard?utm_source=outreach&utm_campaign=mi-distilleries&utm_content=<slug>` |

The retired worker URLs rendered a template with the prospect's name and
placeholder product / town / batch fields. They are not linked from this list
anymore. The intake form is the live estate path that already answers 200.

## Why no personalized passport page

The previous table pointed at a demo worker so a cold email could show a
named mockup. That worker is not an estate, and this list now only cites
URLs that return 200 on a published domain.

Do not paste town, batch, or product copy onto a public URL unless it is
verified. That rule is unchanged: primary sources for these eight were not
good enough to print a town under the company name.

## Before sending: playbook precondition

`.claude/skills/manual-outreach-playbook/SKILL.md` states the cycle applies only
when there is **real data, a verified contact, and an existing relationship**, and
that an address must be Apollo-verified or published by the company itself —
"never a pattern guess".

For these eight, none of the three appears to hold. That does not block listing
live intake URLs, but it does bear on sending: a pattern-guessed address (`info@`,
`hello@`) is what the deliverability runbook is written against. Verify each
contact before any of these goes out.
