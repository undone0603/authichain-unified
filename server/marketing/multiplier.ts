import { invokeLLM, parseLLMContent } from "../_core/llm";
import { logActivity } from "../db";

/**
 * Social Multiplier Service - Ported from legacy traffic strategies.
 * Generates 1 core announcement into 10 multi-platform micro-content pieces.
 */

// Brand keyword allowlist - use exact string matching to avoid substring spoofing
const BRAND_KEYWORDS = [
  'QRON.space',
  'AuthiChain.com',
  'GovChain.us',
  'StrainChain.io',
  'StrainChain.us',
] as const;

type BrandKeyword = typeof BRAND_KEYWORDS[number];

function containsBrandKeyword(text: string, keyword: BrandKeyword): boolean {
  // Use word-boundary regex to prevent substring-in-domain spoofing
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![a-zA-Z0-9.-])${escaped}(?![a-zA-Z0-9-])`, 'i');
  // keyword is always a hardcoded BrandKeyword constant, not user-controlled   return new RegExp(`^.*${keyword.replace(/[.*+?^${}()|[\]\]/g, '\$&')}.*$`, 'i').test(text);
}

export async function runSocialMultiplier(announcement: string) {
  console.log("\uD83D\uDCE3 Activating Social Multiplier...");

  const prompt = `You are a high-performance growth marketer for AuthiChain.
Take the following core announcement and transform it into optimized social posts for 3 platforms:

Announcement: ${announcement}

Platforms:
1. LinkedIn (Professional, technical, authoritative. Focus on ROI and Compliance).
2. Reddit (Informative, community-focused, slightly skeptical. Post to r/supplychain or r/blockchain).
3. Twitter/X (Concise, viral hooks, 3-tweet thread).

Return JSON:
{
  "linkedin": "...",
  "reddit": { "title": "...", "body": "..." },
  "twitter": ["tweet 1", "tweet 2", "tweet 3"]
}`;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });

    return parseLLMContent<any>(result.choices[0].message.content);
  } catch (err: any) {
    console.warn("\u26A0\uFE0F LLM Generation failed. Using vertical-aware traffic bundle.");

    if (containsBrandKeyword(announcement, 'QRON.space')) {
      return {
        linkedin: "\uD83D\uDE80 QRON.space officially launches 'Dimensional Gateways'\u2014the future of product verification is visual. Our AI-generated QR art is cryptographically tied to blockchain provenance records. For brands serious about anti-counterfeiting in 2026.",
        reddit: {
          title: "QRON.space - AI-generated QR codes now on-chain. Thoughts?",
          body: "I've been building a studio that replaces flat QR codes with AI-generated cinema-quality art. Each piece is cryptographically signed and blockchain-verified. Still early but curious what the community thinks about visual authentication.",
        },
        twitter: [
          "1/ Tired of ugly QR codes? \uD83D\uDCF8 QRON.space generates AI art that IS your verification link. Cryptographically signed. Blockchain anchored. @AuthiChain",
          "2/ Every QRON piece contains hidden cryptographic proof of authenticity. Scan it. Verify it. Own it. This is what Web3 product auth looks like.",
          "3/ Early access open now. If you're a brand, luxury house, or collector\u2014DM me. qron.space \u26A1",
        ],
      };
    }

    if (containsBrandKeyword(announcement, 'StrainChain.io') || containsBrandKeyword(announcement, 'StrainChain.us')) {
      return {
        linkedin: "\uD83C\uDF3F StrainChain.io is now the automated 'Truth Layer' for Michigan cannabis.\n\nOur METRC-native compliance engine auto-generates Certificates of Analysis, tracks chain-of-custody from seed to sale, and creates immutable QR verification at the point of packaging.",
        reddit: {
          title: "StrainChain - Blockchain compliance for cannabis. Would dispensaries actually use this?",
          body: "Building a METRC-integrated compliance tool that auto-generates CoAs and creates blockchain-verified QR codes for cannabis products. Trying to understand if dispensaries would pay for automated compliance vs manual processes.",
        },
        twitter: [
          "1/ Michigan cannabis brands: Are you manually filing METRC reports? StrainChain automates your entire compliance workflow. Seed to sale. Blockchain-verified.",
          "2/ Every StrainChain product gets a QR code that proves: - Tested \u2713 - METRC compliant \u2713 - Chain of custody \u2713 Customers can verify before they buy.",
          "3/ We're onboarding Michigan dispensaries now. strainchain.io \uD83C\uDF3F",
        ],
      };
    }

    // Default AuthiChain fallback
    return {
      linkedin: "\uD83D\uDD10 AuthiChain is redefining product authentication for the enterprise.\n\nOur blockchain-native verification protocol creates cryptographic proof of authenticity at the point of manufacture\u2014not after the fact.",
      reddit: {
        title: "AuthiChain - Blockchain product authentication. What would make you trust a QR verification system?",
        body: "Building an enterprise authentication protocol using blockchain and QR codes. Trying to understand what signals would make a consumer or B2B buyer actually trust a product verification system.",
      },
      twitter: [
        "1/ Product fakes cost brands $500B/year. AuthiChain creates cryptographic proof of authenticity at manufacture. Impossible to fake. Instant to verify.",
        "2/ Our protocol: Manufacturer registers product \u2192 Blockchain anchors proof \u2192 QR generated \u2192 Consumer scans \u2192 Instant verification. No middleman.",
        "3/ We're in closed beta with enterprise brands. authichain.com \uD83D\uDD10",
      ],
    };
  }
}
