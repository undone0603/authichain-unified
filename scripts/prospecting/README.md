# Open-data prospect qualification

A free replacement for Apollo's Organization Search, which the current Apollo
plan does not include. It produces a **shortlist** for the manual outreach
playbook (`.claude/skills/manual-outreach-playbook/SKILL.md`). It sends nothing
and writes nothing to the outreach queue.

| Step      | Source                                                                                                          | Cost / licence    |
| --------- | --------------------------------------------------------------------------------------------------------------- | ----------------- |
| Discovery | Wikidata SPARQL (product/industry = segment)                                                                    | free, CC0, no key |
| Contacts  | the company's own site: imprint, contact, legal pages                                                           | free              |
| Gate      | `scripts/dpp-outreach/lib/quality-gate.mjs` role-inbox list, plus the non-English role inboxes that list misses | —                 |

Every address in the output carries the URL it was read from, so each counts
as `published_contact` provenance. Addresses on any other domain (agencies,
platforms, error-tracker DSNs) are dropped. Nothing is guessed.

## Run

```bash
# Network mode (your machine or CI)
node scripts/prospecting/qualify-prospects.mjs --segment ebike --eu-only --max 20 \
  --out docs/research/prospects-ebike-$(date +%F)

# Replay mode, for sandboxes that can't reach the web directly:
# fetch the pages with any tool, save as <dir>/<sha1(url)>.html plus <dir>/sparql.json
node scripts/prospecting/qualify-prospects.mjs --eu-only --cache-dir ./cache --out ...
```

For another segment, pass its Wikidata item: `--qid Q924724` (electric bicycle).
Look items up with
`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=<term>&language=en&format=json`.

## Contact sources that cost $0, best first

1. **Press pages.** They usually name the person behind the press inbox
   (r-m.de/de/presse names Benjamin Wenz, Corporate Communications & PR, at
   `presse@r-m.de`). The crawler checks these paths.
2. **The imprint.** Legally required in DE/AT/CH. It names the managing
   directors, though usually only next to `info@`.
3. **Sustainability reports and press releases.** They name the executive who
   owns the topic and give figures a pitch can quote.
4. **Registers.** stiftung ear's battery-producer list (Germany) and UK
   Companies House give names and qualification, not addresses.
5. **Reacher** (self-hosted, AGPL). Checks that a mailbox exists without
   sending anything. It needs outbound port 25, so it runs on a VPS, not
   in CI.

Apollo's current plan has neither Organization Search nor People Enrichment,
so it is not an option.

## Reading the output

- The score is a ranking aid; each point has a written reason. EU/EEA companies
  come first, because Battery Regulation 2023/1542 applies to them directly.
- `(role)` marks a role inbox. It is fine for a hand-written first touch
  addressed to a named director. The automated gate rejects it.
- `not crawled yet` means no page was fetched. It does **not** mean the company
  publishes no contact.
- Wikidata's classification is crowd-sourced. Check that the company actually
  manufactures before you pitch. The 2026-09-25 run surfaced two retailers:
  ECOX, and CentrumRowerowe.pl/Dadelo.
