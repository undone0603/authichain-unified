# Independent retrieval-channel check (documentary addendum)

Date/time of evidence session: 2026-11-04 03:30-03:32 UTC (2026-11-03 evening America/Detroit).
Target: https://authichain.com/mcp
No HTTP POST was sent.

## Retrievals and limits

| Channel | Observation | Status | Unavailable evidence |
| --- | --- | --- | --- |
| TinyFish `fetch_content`, `format=json`, `ttl=0` | Extracted public JSON shows `serverInfo.name=authichain`, `serverInfo.version=1.4.0`, and seven tool names identical to issue #2326. | OBSERVED IN EXTRACTED CONTENT | Origin HTTP status, raw headers, exact original body bytes, raw-response SHA-256; cache policy can still permit a cached fetch. |
| ChatGPT web retrieval (2026-11-03 local) | Public JSON content again lists `authichain/1.4.0` and the seven tools. Web reader identified `application/json`. | OBSERVED IN EXTRACTED CONTENT | Origin status, raw headers, exact response bytes, and independent reviewer identity. |
| Local Linux `curl` from this working environment, 2026-11-04T03:30:30Z | `curl: (6) Could not resolve host: authichain.com`, reported HTTP `000`, zero bytes downloaded. | INCONCLUSIVE: LOCAL DNS FAILURE | No target HTTP response was received, so no raw body digest is possible. This does NOT establish endpoint outage. |
| Separate independent operator/reviewer reproduction | None recorded. | NOT TESTED | Written permission, reviewer identity, report version, observations, explicit acceptance. |

The two retrieval services returned matching public **content**, but do not provide two independently archived raw HTTP captures. They were initiated within the same owner-side assessment and are **NOT independent cross-operator acceptance**.

Visible tool names:
`get_pricing`, `verify`, `query_provenance`, `verify_attestation`, `verify_record`, `dpp_readiness_check`, `scan_living_qr`.

Visible metadata advertises an x402 paid verification rail and separately marks the Stripe catalogue `on_hold`; this is an advertised capability **not** proof of actual paid processing, customer acceptance, or settled revenue.

## Next evidence gate

On an approved network-accessible host, run `bash CAPTURE-GET.sh /absolute/evidence/directory`, inspect/redact response headers before disclosure, and attach a dated file digest, status and reproducibility evidence. No script run from this assessment produced a server HTTP response.

The owner-authored documentary package remains valid in its stated scope. Raw wire conformance, modern/legacy POST behavior and external acceptance remain NOT VERIFIED.
