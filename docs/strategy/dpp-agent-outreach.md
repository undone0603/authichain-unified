# DPP readiness outreach strategy (2026-11-22)

The first product to push is the EU Digital Product Passport readiness check:
free for anyone, with an optional one-time EU DPP Workspace (`src/lib/plans.ts`
`dpp_readiness`, which is not an audit, a certification or legal advice). There
are two audiences, and each gets its own channel.

## 1. Agents (machine buyers)

Agents find tools through well-known files and directories, then call them.
Every surface must answer from live data.

| Surface | State after this change | Next action |
| --- | --- | --- |
| A2A agent card `/.well-known/agent-card.json` | authichain.com plus all three sisters; free `dpp-readiness-check` and paid `paid-evidence-check` skills | Submit to A2A agent directories |
| MCP `/mcp` | `dpp_readiness_check` on authichain.com and all three sisters | Publish `server.json` (MCP registry) once `mcp-registry-publish.yml` is released from operator hold |
| x402 discovery (`/.well-known/x402`, bazaar metadata on 402) | Live; sister payments settle on authichain.com after #2707 | Confirm a PayAI Bazaar listing after the first real settlement |
| `llms.txt` and OpenAPI | Live on all four hosts | Add the DPP check line to sister `llms.txt` |

Measure: MCP `tools/call dpp_readiness_check` volume per host, A2A card fetches,
and x402 settlements, proven with `python -m agentz.cli capabilities prove-settlement <tx>`.

## 2. Humans (brands that owe a passport)

Lead with the dated obligation: battery passports are law from 18 February 2027
for industrial batteries above 2 kWh and EV batteries (Regulation (EU)
2023/1542). Textiles follow under ESPR, with the delegated act still in
preparation.

Order of effort:

1. **Channels before companies.** GS1 Germany's PINE solution-provider
   directory lists DPP providers, and AuthiChain is not listed yet. Industry
   associations already run SME passport programmes: ANIVEC for apparel and
   EURATEX for textiles.
2. **Mid-sized battery makers that build their own packs** and have published
   no passport plan, such as industrial forklift and commercial storage makers.
   Large OEMs and consortium members already have vendors.
3. **One message:** run the free check, see the gaps and the date. The
   workspace is offered only after the check, in its own words.

Rules:

- Consent first. No cold bulk email; the owner sends each first message.
- Claim only live capabilities. Do not claim certification, audits, EUDAMED
  registration, or physical authenticity.
- Every number in a message comes from the check or the regulation text, never
  from a stored total.
