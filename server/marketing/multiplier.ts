import { invokeLLM, parseLLMContent } from "../_core/llm.js";

/**
 * Social Multiplier Service — Ported from legacy traffic strategies.
 * Generates 1 core announcement into multi-platform micro-content.
 */

/**
 * Domains that have a hand-written fallback bundle, in precedence order. An
 * announcement that mentions more than one gets the first match, so the order
 * here is the tie-break rule.
 */
const VERTICAL_DOMAINS = ["qron.space", "strainchain.io", "govchain.us"] as const;

/**
 * Every hostname mentioned in the announcement, whether written as a URL
 * ("https://qron.space/studio") or bare ("QRON.space launches...").
 *
 * The previous implementation only parsed `https?://` URLs, so it found nothing
 * in any of the ecosystem announcements — they all use bare domains — and every
 * vertical silently fell through to the generic AuthiChain bundle. StrainChain
 * announcements went out as MedTech ISO 13485 copy.
 *
 * Tokens are compared whole against the known list, never by substring, so
 * "evil-qron.space" tokenises to "evil-qron.space" and matches nothing.
 */
function announcedHosts(announcement: string): Set<string> {
  // The trailing `\.[a-z]{2,}` requires an alphabetic TLD, so version strings
  // and similar dotted tokens ("Apache-2.0", "v0.1.0") are not read as hosts.
  const DOMAIN_TOKEN = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}/gi;
  const hosts = new Set<string>();
  for (const token of announcement.match(DOMAIN_TOKEN) ?? []) {
    hosts.add(token.toLowerCase().replace(/^www\./, ""));
  }
  return hosts;
}

/**
 * Reddit's self-promotion rules on r/supplychain and r/blockchain require
 * disclosure. These bundles are posted by automation (see generate_bundle.ts),
 * so an undisclosed first-person "I've been building..." post is astroturfing
 * and gets the account banned — the cheapest possible way to lose the channel.
 */
const DISCLOSURE = "Disclosure: I work on this project.";

type Bundle = {
  linkedin: string;
  reddit: { title: string; body: string };
  twitter: string[];
};

/**
 * Hand-written fallbacks used when the LLM is unavailable.
 *
 * Every performance figure that used to appear here — 78% higher scan rates,
 * 80% less audit labour, $400K of recall risk avoided, sub-2-second field
 * verification — was invented. None was measured and none had a source. They
 * are removed rather than restated: these bundles get published to LinkedIn,
 * Reddit and X, which makes them the most expensive place in the repo to carry
 * a number nobody can defend.
 *
 * Claims kept are the ones that are checkable: Ed25519 signing and Bitcoin/
 * Polygon anchoring are what the protocol actually does (see protocol/SPEC.md),
 * and CAGE 1PUJ6 is a real assigned code (docs/submissions/).
 *
 * Every CTA must resolve to a page that exists. `authichain.com/roi-calculator`
 * did not: the route lives only in the legacy wouter SPA (client/src/App.tsx),
 * and the worker that actually serves authichain.com has no handler for it, so
 * the path fell through to the marketing homepage. Readers clicking "quantify
 * your savings" got a generic landing page and no calculator.
 */
const BUNDLES: Record<string, Bundle> = {
  "qron.space": {
    linkedin:
      "🚀 QRON.space launches 'Dimensional Gateways' — AI-generated cinematic identity for physical products.\n\nEvery gateway is a working QR code that is also part of the product's visual story, cryptographically signed with Ed25519 and anchored to the AuthiChain Protocol. The signature is verifiable offline by anyone, with no QRON account.\n\nBuild one: qron.space\n\n#QRON #AIArt #ProductIdentity #Blockchain",
    reddit: {
      title: "Replacing flat QR codes with AI-generated art that still scans",
      body:
        "We've been building a studio that generates cinematic QR art instead of the usual black-and-white block, on the theory that a code which belongs to the product gets engaged with more than one stapled onto it. Each code is signed with Ed25519 and anchored on-chain, and the verifier is open source and runs offline, so you can check a signature without touching our infrastructure.\n\nWe don't have public scan-rate numbers yet — that's the measurement we're setting up next, and I'd rather say so than quote something.\n\nGenerator: qron.space — spec and verifier: authichain.com/protocol\n\n" +
        DISCLOSURE,
    },
    twitter: [
      "1/ A QR code is the least interesting square on your packaging. It doesn't have to be.",
      "2/ QRON generates 'Dimensional Gateways' — AI art that scans like a normal code.",
      "3/ Each one is Ed25519-signed and anchored to AuthiChain. Verify it offline, no account: qron.space 🌌",
    ],
  },

  "strainchain.io": {
    linkedin:
      "🌿 StrainChain.io now anchors Michigan METRC manifests automatically.\n\nA background job pulls manifests and writes a hash to Bitcoin L1, producing a 'Proof of Purity' record for every package tag that a regulator or buyer can verify independently — the anchor either matches or it doesn't.\n\nSee how it works: strainchain.io\n\n#StrainChain #CannabisCompliance #BitcoinL1 #METRC",
    reddit: {
      title: "Anchoring Michigan METRC manifests to Bitcoin L1 for independent audit",
      body:
        "We just shipped a background job that pulls Michigan METRC manifests and anchors a hash of each one to Bitcoin L1. The point is that verification stops depending on us: the hash either matches the manifest or it doesn't, and anyone can check it with the open-source verifier.\n\nWhat I'd genuinely like input on from other MSOs is the legal side — whether an on-chain anchor carries any weight with the CRA today, or whether it's purely a supplementary control for now.\n\nstrainchain.io\n\n" +
        DISCLOSURE,
    },
    twitter: [
      "1/ METRC manifests are auditable in theory and painful in practice.",
      "2/ StrainChain now anchors Michigan manifests to Bitcoin L1 automatically.",
      "3/ Every package tag gets a 'Proof of Purity' hash anyone can verify: strainchain.io 🌿",
    ],
  },

  "govchain.us": {
    linkedin:
      "🏛️ GovChain.us is deploying W3C Verifiable Credentials for federal and defense supply chains.\n\nCredentials are signed with Ed25519 and verify against the issuer's published key, so a receiving agency can validate one in the field without calling back to us. CAGE 1PUJ6.\n\nRead the specification: govchain.us\n\n#GovChain #FederalSecurity #W3C #VerifiableCredentials #CAGE1PUJ6",
    reddit: {
      title: "W3C Verifiable Credentials for federal supply chains — implementation notes",
      body:
        "We've finished a W3C VC implementation for sovereign documents, signing with Ed25519 and canonicalising with RFC 8785 so the same document always produces the same bytes to sign. The design goal was offline field verification: the receiving side needs the issuer's public key and nothing else.\n\nThe specification and reference verifier are Apache-2.0, so this is implementable by anyone including competitors — feedback on the canonicalisation choices especially welcome.\n\ngovchain.us — spec: authichain.com/protocol\n\n" +
        DISCLOSURE,
    },
    twitter: [
      "1/ Credential forgery in federal supply chains is a document problem, not a database problem.",
      "2/ GovChain issues W3C Verifiable Credentials, Ed25519-signed, verifiable offline.",
      "3/ Apache-2.0 spec and reference verifier — implement it yourself: govchain.us 🏛️",
    ],
  },
};

const DEFAULT_BUNDLE: Bundle = {
  linkedin:
    "🚀 AuthiChain has opened its verification protocol under Apache-2.0.\n\nThe specification, the reference verifier and a 28-fixture conformance suite are public. Any implementation — including a competitor's — can run the suite and claim conformance. Records are Ed25519-signed and anchored on-chain, and verification runs offline with no AuthiChain account.\n\nRead the spec: authichain.com/protocol\n\n#Provenance #Blockchain #Compliance #OpenStandards",
  reddit: {
    title: "We open-sourced our provenance verification spec, verifier, and conformance suite",
    body:
      "The specification, a zero-dependency reference verifier and a 28-fixture adversarial conformance suite are now Apache-2.0 — patent grant included, specifically so an enterprise legal team can sign off on implementing it.\n\nThe reasoning: a spec others are forbidden to implement isn't a standard, and a verifier nobody can run independently isn't proof. The suite is validated against deliberately broken implementations so it demonstrably can fail. Two of the fixtures exist because our own earlier product violated them — testnet anchors presented as production evidence, and truncated transaction hashes rendered as if they linked somewhere.\n\nauthichain.com/protocol\n\n" +
      DISCLOSURE,
  },
  twitter: [
    "1/ A verification you have to ask the vendor to perform for you isn't verification.",
    "2/ AuthiChain's spec, reference verifier and 28-fixture conformance suite are now Apache-2.0.",
    "3/ Run it against any implementation, including ours: authichain.com/protocol 🚀",
  ],
};

/** Exported for tests: picks the fallback bundle an announcement should use. */
export function selectFallbackBundle(announcement: string): { id: string; bundle: Bundle } {
  const hosts = announcedHosts(announcement);
  for (const domain of VERTICAL_DOMAINS) {
    if (hosts.has(domain)) return { id: domain, bundle: BUNDLES[domain] };
  }
  return { id: "default", bundle: DEFAULT_BUNDLE };
}

export async function runSocialMultiplier(announcement: string) {
  console.log("📢 Activating Social Multiplier...");

  const prompt = `You are a high-performance growth marketer for AuthiChain.
Take the following core announcement and transform it into optimized social posts for 3 platforms.

Announcement: ${announcement}

Rules:
- Do not invent statistics, percentages, dollar figures or timings. If the announcement does not contain a number, do not introduce one.
- Do not claim certifications (SOC 2, ISO 27001, FIPS 140-2 validation). State only what the announcement states.
- Only link to URLs that appear in the announcement.
- The Reddit post is published by automation, so it must end with an affiliation disclosure.

Platforms:
1. LinkedIn (Professional, technical, authoritative. Focus on verifiability and compliance).
2. Reddit (Informative, community-focused, slightly skeptical. Post to r/supplychain or r/blockchain).
3. Twitter/X (Concise, 3-tweet thread).

Return JSON:
{
  "linkedin": "...",
  "reddit": { "title": "...", "body": "..." },
  "twitter": ["tweet 1", "tweet 2", "tweet 3"]
}
  `;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });

    return parseLLMContent<any>(result.choices[0].message.content);
  } catch (err: any) {
    const { id, bundle } = selectFallbackBundle(announcement);
    console.warn(`⚠️ LLM generation failed (${err?.message ?? err}). Using the "${id}" fallback bundle.`);
    return bundle;
  }
}
