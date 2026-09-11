# GS1 Conformant Resolver — gap analysis

**Date:** 2026-09-11 · **Status:** not conformant, deliberately declared as such.

## Why this matters

GS1 released **Conformant Resolver v1.2.0 in January 2026** and publishes a
conformance test suite. The **EU DPP registry goes live in July 2026**, and GS1
Digital Link is the dominant implementation route for ESPR compliance.

Conformance is worth pursuing because it is a credential _someone else issues_.
"Our passports look good" is a claim about ourselves. "Passes the GS1
conformant-resolver test suite" is not. See decision D4 in
`docs/strategy/strainchain-genetics-passport.md`.

## What was found

`workers/gs1-resolver` parses GS1 Digital Link URIs and answers a verification
question about the identifier. It implements **none** of Digital Link's
resolution behaviour:

| Behaviour                                      | Present |
| ---------------------------------------------- | ------- |
| `linkType` query parameter                     | no      |
| `linkType=all` returning a linkset             | no      |
| `Link` HTTP header exposing the linkset        | no      |
| `307` redirect to a linked resource            | no      |
| `application/linkset+json` content negotiation | no      |
| `/.well-known/gs1resolver` description file    | yes     |
| CORS on JSON responses                         | yes     |

Until 2026-09-11 the description file nevertheless called the service a
"GS1 Conformant Resolver" and advertised `supportedLinkType` of `gs1:pip`,
`gs1:certificationInfo` and `gs1:epcis` — three link types nothing here can
serve. A machine reading a description file is entitled to act on it, so that
was a false capability assertion, and on a product whose whole proposition is
not overclaiming it was the worst possible place to have one.

The document now reports `gs1ConformantResolver: false`, an empty
`supportedLinkType`, and a note saying what the service actually does. An empty
list is a true statement; the previous list was not.

## What conformance would require

From secondary sources (the normative spec was unreachable — see below):

1. A Resolver Description File at `/.well-known/gs1resolver` validating against
   the JSON schema at `ref.gs1.org/standards/resolver/description-file-schema`.
2. `linkType` accepting a URI, a CURIE, or the literal `all`, with a **307**
   redirect to the matching link when one exists.
3. The linkset exposed in the HTTP `Link` header.
4. Content negotiation, including `application/linkset+json`.
5. Whatever else the standard requires. This list is not known to be complete.

## Why this is not implemented yet

**The normative specification is unreachable from this environment.** The egress
policy blocks `gs1.org`, `ref.gs1.org` and `gs1.github.io`, so the standard, the
description-file JSON schema, and the conformance test suite cannot be read or
run here.

Implementing a standard from secondary summaries would produce something that
_looks_ conformant and has not been checked against the specification — which,
on a conformance claim, is worse than declaring non-conformance. So the
declaration was corrected and the implementation was left alone.

## To proceed

Either add `gs1.org`, `ref.gs1.org` and `gs1.github.io` to the environment's
egress allowlist, or supply the standard and the description-file schema
directly. With the spec in hand the work is:

1. Validate the description file against the published schema.
2. Implement `linkType` handling with 307 redirects, `linkType=all`, and the
   `Link` header.
3. Run GS1's conformance test suite and fix what it reports.
4. Flip `gs1ConformantResolver` to true **only** after the suite passes.

Step 4 is the only one that may not be taken on judgement.

## Sources

- <https://ref.gs1.org/standards/resolver/> (blocked here; cited from search results)
- <https://gs1.eu/activities/digital-product-passport/>
- <https://www.gs1.org/standards/gs1-digital-link> (blocked here)
