# Recovered work: first-pass PR triage

Evidence date: 2026-10-22. Source: the GitHub open pull request listing for `undone0603/authichain-unified` (102 open per the Pull requests tab).
The newest 100 were read: 95 non-Dependabot (70 draft, 25 ready) and 5 Dependabot, created 2026-10-14 onward. Two older PRs were not read.

**Limits of this pass.** Grouping is by title, author, draft flag, labels and creation date. No PR's code was reviewed, and GitHub Actions is
billing-locked (BLOCKERS B-4), so none has real CI. Nothing here is a merge or close recommendation until the code is read. "Duplicate" below
means "same title pattern", not "same diff".

## Flags that need the owner first

| PR | Why it matters |
| -- | -------------- |
| #1905 (`hold`, ready) | "HOLD: Unlist QRON Launch $19/mo". Records that the owner took monthly Launch off sale on 2026-10-17 and carries `listed: false` plus the copy removals. Directly affects BLOCKERS B-1 and PR #1996. Its own merge gates: #1900 live, Research PASS at the head SHA, Fleet Auditor review, Advisor MERGE |
| #1965 (draft) | "unlist Launch on /pricing" plus a public Base mint page. Overlaps #1905 |
| #1941 (draft) | "restore the confirm-page gate". Written before the 2026-10-22 `cb3f7d2f` edit to the same file; will conflict |
| #1851 (draft) | Opt-in result email plus a follow-up email. Outbound communication: `production_send` must stay `false` until the owner changes it |
| #1921, #1931, #1885 | Grokbot harvester, bot identities, revenue-worker port ("no paid calls, drafts only [hold]"). Review for outbound or paid actions before anything else |
| #1881, #1883 | Revert of an "unreviewed direct push" (`40516a11`) and a follow-up fix, both marked HOLD. Shows direct pushes to `main` have happened; `cb3f7d2f` is another |

## Themes (by number)

- **Checkout, pricing, Launch:** #1996 (mine, on hold), #1965, #1941, #1932 (close the Farm checkout route), #1905, #1904 (terms credit wording, HOLD), #1970 (hard upgrade prompt).
- **x402 and seal-refusal series, same title pattern across surfaces:** #1894, #1896, #1897, #1899, #1901, #1893, #1936, #1937, #1938, #1939. Likely overlapping; reconcile into one reviewed change.
- **CI and deploy:** #1981 and #1935 (both restore the edge-router Cloudflare deploy), #1982, #1983, #1987 (CircleCI), #1985 (Chunk config), #1918 (Actions probe for issue #1871), #1880, #1879, #1867 (watchdog that works without Actions), #1862.
- **Evidence and passport (truth-layer honesty):** #1980, #1976, #1974, #1964, #1963, #1962, #1961, #1960, #1959, #1958, #1957, #1956, #1955, #1954, #1952.
- **Docs and copy honesty sweeps:** #1951, #1950, #1949, #1948, #1947, #1946, #1945, #1943, #1942, #1933, #1929, #1926, #1887, #1886, #1878, #1870, #1863.
- **Verify, protocol, MCP:** #1968, #1967, #1966, #1944, #1940, #1920, #1919, #1917, #1916, #1903, #1869, #1866.
- **Trust, security, contracts:** #1865, #1850, #1849, #1848 (harden `CounterfeitBounty` before deploy), #1847, #1846, #1844, #1843, #1856 (Supabase invoker-mode view grants, ties to issue #1735), #1842.
- **Revenue worker:** #1885, #1884, #1883, #1881.
- **Agent-authored WIP:** #1853 and #1845 (Copilot, `[WIP]`), #1864 and #1866 (claude branches).
- **Dependabot:** 5 in the newest 100 (#1988 to #1994 range). Per the repo's own note, most Dependabot CI failures are stale branches against a fast-moving `main`.

## Suggested order (review first, merge nothing yet)

1. Resolve BLOCKERS B-1 against #1905, #1965, #1941 and #1996 as one decision.
2. Read #1848, #1846 and #1865 (security-sensitive) and #1851, #1921, #1885 (outbound or paid actions).
3. Pick one PR from each duplicate pattern (x402 seal refusal, edge-router deploy, CircleCI) and fold the rest in.
4. Re-run the repository test suite on any PR before merge; GitHub checks cannot run until billing is restored.
