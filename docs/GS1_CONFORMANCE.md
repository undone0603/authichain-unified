# GS1 Conformant Resolver: status

**Updated:** 2026-09-30 · **Status:** resolution behaviour implemented and
tested locally against the suite's checks. **Not yet run against GS1's hosted
test suite, so no conformance is claimed anywhere.**

## Why this matters

GS1 released **Conformant Resolver v1.2.0 in January 2026** and publishes a
conformance test suite. The **EU DPP registry goes live in July 2026**, and GS1
Digital Link is the dominant implementation route for ESPR compliance.

Conformance is worth pursuing because it is a credential _someone else issues_.
"Our passports look good" is a claim about ourselves. "Passes the GS1
conformant-resolver test suite" is not. See decision D4 in
`docs/strategy/strainchain-genetics-passport.md`.

## Where the criteria came from

The 2026-09-11 version of this doc stopped because `gs1.org`, `ref.gs1.org`
and `gs1.github.io` are blocked from the build environment. The criteria are
also on GitHub, which is reachable:

- `github.com/gs1/GS1DL-resolver-testsuite`: `Conformance1_2.txt` (the 18
  v1.2 statements) and `GS1DigitalLinkResolverTestSuite.js` (exactly what the
  hosted suite checks, last updated 2026-08-07).
- `github.com/gs1/linkset`: `gs1-linkset-schema.json`, the schema the suite
  validates linksets against. Our linkset validates against it (checked with
  ajv).
- The suite's own `GS1DigitalLinkToolkit.js` (Apache 2.0) is vendored at
  `workers/gs1-resolver/src/vendor/`, so URI validation and decompression agree
  with the suite rather than with our reading of the standard.

The description-file schema (`ref.gs1.org/standards/resolver/description-file-schema`)
is **not** on GitHub and was not checked. The description file follows GS1's
Resolver Community Edition example instead. If the hosted suite fails `rdFile`,
that is the first place to look.

## How the resolver behaves now

`workers/gs1-resolver`, for `/01/{gtin}[/22/…][/10/…][/21/…]` and compressed
Digital Link URIs:

| Suite check                             | Behaviour                                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `methodsCheck`, `corsCheck`             | GET, HEAD, OPTIONS; `access-control-allow-origin: *` everywhere                         |
| `reportWith400`, `noErrorWith200`       | Bad syntax, wrong check digit or out-of-order qualifier: 400                            |
| `trailingSlash`                         | Stripped before parsing; identical response                                             |
| `defaultTarget`                         | 307 to the one `gs1:defaultLink`                                                        |
| `qsPassedOn`                            | The request's query string is appended to every redirect                                |
| `legacyLinkHeaders`                     | `Link` carries only `rel="linkset"` (and `owl:sameAs` if compressed)                    |
| `ltLinksetNoRedirect`, `ltAcceptHeader` | `linkType=linkset`, `linkType=all` or `Accept: application/linkset+json`: 200 linkset   |
| `validLinkset`, `declaredContentType`   | RFC 9264 linkset, `application/linkset+json`                                            |
| `linksetJsonldCheck`                    | `Link` to the JSON-LD context on linkset responses                                      |
| `defaultLinkExists`, `singleDefaulLink` | Exactly one default link per level, `href` and `title` only                             |
| `loFor…`                                | `linkType=gs1:certificationInfo` (CURIE or URI): 307 to the passport                    |
| `specificLinkTypeNotFound`              | Unknown link type: 404                                                                  |
| `basicWalkUp`                           | Unknown lot or variant walks up to the GTIN                                             |
| `linkTypesDefined`                      | Only `defaultLink` and `certificationInfo`, both ratified                               |
| Compression (statements 4 and 5)        | Decompressed; uncompressed URI in `Link` as `owl:sameAs` (the suite does not test this) |

Each row has a test in `workers/gs1-resolver/src/conformance.test.ts`.

### Links served

- **Registered item** (serial, lot or GTIN-level seal): `gs1:defaultLink` goes
  to `/verify/01/…`, the verification result, which records the scan on GET.
  `gs1:certificationInfo` goes to the passport at `authichain.com/passport/{certId}`,
  which records nothing.
- **GTIN with registered items**: `gs1:defaultLink` goes to `/verify/01/{gtin}`,
  a page that says what is registered under the GTIN and that it verifies no
  single item.

### Deliberate choices

- **Resolving never records a scan.** Only a GET on the `/verify` target does.
  A HEAD, a linkset request, a crawler, or the test suite probing the URI
  cannot move a seal toward `clone_suspected`. Before this change a HEAD on a
  Digital Link path counted as a scan.
- **An unregistered serial does not walk up.** It stays `not_found` (404). The
  standard says a resolver supports all key qualifiers by walking up, but
  walking an unknown serial up to the GTIN would put someone holding a
  possibly counterfeit serial on a page for the genuine product. The suite's
  walk-up check uses a lot (`/10/KL8G`), which does walk up.
- `/cert/{id}` stays as it was: not a Digital Link, verifies directly.

## To finish

1. Deploy `gs1-resolver` (it deploys with the workers workflow) and attach
   the custom domain `id.authichain.com` to it in the Cloudflare dashboard.
   Production D1 has no seals yet (checked 2026-09-30), so issue one real seal
   through `POST /issue` first. The suite needs a Digital Link that resolves.
2. Run `ref.gs1.org/test-suites/resolver/` against that seal's Digital Link,
   e.g. `https://id.authichain.com/01/{gtin}/21/{serial}`.
3. Fix what it reports, and record the result and date here.
4. Only after a clean pass may any page or the description file say
   "GS1-Conformant". `BANNED_COPY` in `workers/authichain-com/src/docs-pages.ts`
   blocks the phrase until then; remove it in the same change as the evidence.

## Sources

- <https://github.com/gs1/GS1DL-resolver-testsuite>
- <https://github.com/gs1/linkset>
- <https://github.com/gs1/GS1_DigitalLink_Resolver_CE> (description file shape)
- <https://ref.gs1.org/standards/resolver/> (blocked here)
