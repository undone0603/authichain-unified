# Opportunity pipeline, 2026-11-11

No-fee funding and program opportunities, ranked. Nothing here has been submitted. A grant that has not been awarded is not revenue.

**How it is ranked:** likely value, times the odds of getting it, times how soon it pays, divided by the work and the obligations it carries. The odds are my estimate, not a statistic.

**Facts every application has to stay inside** (read on 2026-11-11, sources in `docs/AUTONOMOUS_ECONOMY_STATUS.md`):

- Revenue from customers: $0. No paying customer, no subscription, no signed partner, no pilot in progress.
- One founder, no employees. Based in Roscommon, Michigan.
- What exists and can be shown: the open verifier `authichain-verify` 0.1.1 on npm (Ed25519 signature over an RFC 8785 canonical record, offline), a Python port that passes the same 28 conformance fixtures, one record anchored on Polygon mainnet (block 94680852), and a live x402 endpoint that quotes 0.05 USDC on Base for a signed evidence check. No x402 settlement from an outside payer has been verified.
- Not verified from this repository: whether the SAM.gov registration behind the UEI recorded in `NSF_SBIR_Project_Pitch_Final.md` is active. Federal applications need it active. The founder has to confirm it.

## Ranked

| #   | Opportunity                                                                                   | Value                                                                                        | Fee  | Odds                       | Who can submit                                                     | Status of the source                                                                                                              |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | -------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Michigan SBDC Tech Team consulting, including SBIR proposal review                            | No cash. Free expert review, and the route into rows 2 and 4                                 | None | High                       | Founder (an intake conversation, not a form an agent can complete) | Read on michigansbdc.org today                                                                                                    |
| 2   | NSF SBIR Phase I, Project Pitch first                                                         | Up to about $275,000 to $323,000 if a full proposal is later invited and awarded             | None | Low                        | Founder, through the NSF portal under their own login              | Requirements read on seedfund.nsf.gov today. The page shows no pause notice, but I did not confirm the submission window is open  |
| 3   | Vendor startup credits (Cloudflare, Microsoft, others already listed in `grant_applications`) | Cost avoided, not cash. Current infrastructure spend is near $0, so the value today is small | None | Medium                     | Founder (each needs an account and acceptance of program terms)    | Not re-read today                                                                                                                 |
| 4   | Michigan Emerging Technologies Fund match                                                     | Up to $25,000 on a Phase I award, up to $125,000 on Phase II                                 | None | Only after a federal award | Founder                                                            | Read on mietf.org and michigansbdc.org today                                                                                      |
| 5   | DOE SBIR/STTR Phase I                                                                         | Up to $300,000                                                                               | None | Very low                   | Founder                                                            | Aggregator listing only, deadline shown as 2026-12-16. Topics are energy technologies; fit was not checked against the topic list |
| 6   | Michigan Business Accelerator Fund                                                            | Services worth $7,000 to $50,000                                                             | None | Not open to us directly    | A SmartZone accelerator applies for its clients                    | Read on michigansbdc.org today                                                                                                    |

## Notes on each

**1. Michigan SBDC Tech Team.** One-on-one consulting at no cost, with consultants who review SBIR/STTR proposals. It costs an hour and commits to nothing. It is first because it improves the odds of row 2 and is the door to rows 4 and 6. Next step: the founder requests a consultant at michigansbdc.org.

**2. NSF SBIR Project Pitch.** Four text boxes: innovation (3,500 characters), technical objectives and challenges (3,500), market (1,750), company and team (1,750). NSF answers in about one to two months. Limits: one pitch under review at a time, two per 12 months, three ever for the same project. A draft that stays inside the facts above is in `NSF_SBIR_Project_Pitch_2026-11-11_DRAFT.md`.

Why the odds are low: NSF funds high-risk research, not product engineering, and it asks for a team that is technically qualified to do that research. Most of what AuthiChain has built is integration work. The draft is built around the one open research problem the product has. A reviewer may still read it as engineering. Because only three pitches are ever allowed per project, get the SBDC review (row 1) before spending one.

**Do not submit `NSF_SBIR_Project_Pitch_Final.md` as written.** It calls the system "the world's first", calls Ed25519 signatures "quantum-resistant" (they are not), says every major manufacturer is required to adopt this technology, cites market figures with no source, and reports outreach to named companies as traction. An NSF submission is a statement to a federal agency.

**3. Vendor credits.** Worth doing when a bill appears. They do not move revenue, so they are not worth founder time this week.

**4. Emerging Technologies Fund.** A match on a federal SBIR/STTR award, until the fund runs out. Nothing to do until row 2 produces an award.

**5. DOE SBIR.** Listed because it has a dated deadline. A provenance product has no obvious DOE topic. Do not spend time unless a topic in the current DOE list names supply-chain or component authentication.

**6. Business Accelerator Fund.** Paid to accelerators for their clients. The route is to become a client of a SmartZone accelerator, which row 1 can advise on.

## Looked at and dropped

- **Arc Microgrants (Circle, on DoraHacks), 500 USDC each.** The deadline shown was 2026-10-14, which has passed, and it is for projects on Arc. AuthiChain settles on Base.
- **WatchGuard AI Innovation Challenge.** For managed service providers. Not us.
- **"Cybersecurity for Small Business Program", SBA, up to $50,000.** Appears only in an aggregator. SBA does not make grants of that kind to businesses directly. Treated as not real until a primary source shows it.
- **Pitch contests whose prize is "investor exposure".** No cash, and they ask for a traction story the company cannot truthfully tell yet.

## The existing tracking tables are stale and should not be used as written

`public.grant_applications` (40 rows) and `public.competitions` (16 rows) were filled in April 2026.

- Most dated deadlines have passed. Examples: YC S26 on 2026-04-11, DOE on 2026-05-27, EPA on 2026-06-15, TechCrunch on 2026-07-01.
- Ten rows say `submitted` and seven of those have no `submitted_at` and no confirmation on file. Several say only "Email sent Apr 5". An email to a program inbox is not an application. Treat them as not submitted unless a confirmation turns up.
- The stored pitch text makes claims nothing supports: "$41M pipeline", "100 deals $41M ACV", "Beats VeChain", a "$299/mo" plan that is not in `src/lib/plans.ts`, and "METRC integration". None of that text should be reused.

I did not edit those tables. Correcting them is a production data change and is the owner's call.

## What would change the ranking

One paying customer. Almost every program above, and every investor-facing contest, scores traction. A first settled sale from someone outside the company is worth more to these applications than any amount of drafting.
