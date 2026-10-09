# Dogfood identity ledger (DOGFOOD-IDENTITY-V1)

`ledger.jsonl` is append-only and hash-chained (`prev` = sha256 of the previous
line's exact text). CI (`Dogfood ledger append-only` in `ci.yml`) fails if any
existing line is edited, reordered or removed.

`pieces/` holds the exact bytes and signed envelope of every logged piece, so
the Auditor can re-verify any 5 at random:

    node protocol/dogfood/cli.mjs verify --content pieces/<id>.txt --envelope pieces/<id>.envelope.json

Add lines only with `node protocol/dogfood/cli.mjs append ...`. Never hand-edit.
`qualify` reports eligibility for the Auditor check; unlock is PM's written
call, never a ledger state.

A dry run only counts toward `qualify` if its ledger line cites a Research
claims-gate PASS on that exact `content_sha256` (`--claims-gate-id`,
`--claims-gate-sha256`) and its stored bytes in `pieces/` still hash to it.
Email dry runs also need `--email-checks` (DNC list check, a 2xx opt-out probe,
EU flag), and the bytes must carry the footer postal address, that opt-out
link and, for EU/UK recipients, `https://authichain.com/privacy#eu-uk`.
