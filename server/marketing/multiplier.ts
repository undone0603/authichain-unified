import { invokeLLM, parseLLMContent } from "../_core/llm";
import { logActivity } from "../db";

/**
 * Social Multiplier Service — Ported from legacy traffic strategies.
 * Generates 1 core announcement into 10 multi-platform micro-content pieces.
 */
export async function runSocialMultiplier(announcement: string) {
  console.log("📢 Activating Social Multiplier...");

  const prompt = `You are a high-performance growth marketer for AuthiChain.
Take the following core announcement and transform it into optimized social posts for 3 platforms.

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
}
  `;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });

    return parseLLMContent<any>(result.choices[0].message.content);
  } catch (err: any) {
    console.warn("⚠️ LLM Generation failed. Using vertical-aware traffic bundle.");
    
    if (announcement.includes("QRON.space")) {
      return {
        linkedin: "🚀 QRON.space officially launches 'Dimensional Gateways'—the future of product engagement.\n\nOur AI-powered gateways drive 78% higher scan rates vs standard QR codes. Every gateway is cryptographically signed and anchored to the AuthiChain Protocol. Turn your physical product into a cinematic digital portal today.\n\nExplore the studio: qron.space\n\n#QRON #AIArt #ProductIdentity #Blockchain",
        reddit: {
          title: "Increasing QR scan rates by 78% with AI-generated 'Dimensional Gateways'",
          body: "I've been building a studio that replaces flat QR codes with AI-generated cinematic gateways. Data shows consumers engage significantly more when the code is part of the product's visual story. Every code is cryptographically signed using Ed25519. Check out the generator: qron.space"
        },
        twitter: [
          "1/ Standard QR codes are dead. Consumers ignore them.",
          "2/ QRON just launched 'Dimensional Gateways'—AI art that drives 78% higher engagement.",
          "3/ Every gateway is cryptographically signed and anchored to AuthiChain. Build your portal: qron.space 🌌"
        ]
      };
    }

    if (announcement.includes("StrainChain.io")) {
      return {
        linkedin: "🌿 StrainChain.io is now the automated 'Truth Layer' for Michigan cannabis.\n\nOur new background job automatically anchors METRC manifests to Bitcoin L1. Cultivators now receive an immutable 'Proof of Purity' certificate for every package tag, eliminating 80% of manual audit labor.\n\nVerify your provenance: strainchain.io\n\n#StrainChain #CannabisCompliance #BitcoinL1 #METRC",
        reddit: {
          title: "Automating METRC audits with Bitcoin L1 anchoring (StrainChain)",
          body: "We just launched a background job that pulls Michigan METRC manifests and anchors them to Bitcoin L1 in real-time. This creates a permanent 'Proof of Purity' for every batch that regulators can verify in seconds. Would love to hear from other MSOs on the legal implications: strainchain.io"
        },
        twitter: [
          "1/ Manual METRC audits take hundreds of hours per quarter. Not anymore.",
          "2/ StrainChain now automatically anchors Michigan cannabis manifests to Bitcoin L1.",
          "3/ Get your 'Proof of Purity' certificate and automate your CRA reporting: strainchain.io 🌿"
        ]
      };
    }

    if (announcement.includes("GovChain.us")) {
      return {
        linkedin: "🏛️ GovChain.us achieves 'Sovereign Document' status (CAGE 1PUJ6).\n\nWe are now deploying W3C Verifiable Credentials for federal and defense supply chains. Secure your credentials with FIPS 140-2 HSM-grade cryptographic truth and prevent state-level forgery in under 2 seconds.\n\nView the Sovereign Protocol: govchain.us\n\n#GovChain #FederalSecurity #W3C #VerifiableCredentials #CAGE1PUJ6",
        reddit: {
          title: "Deploying FIPS-grade W3C Verifiable Credentials for federal supply chains",
          body: "Our protocol (CAGE 1PUJ6) just finalized its W3C VC implementation for sovereign documents. We use Ed25519 signatures and FIPS 140-2 compliance to secure credentials against state-level forgery. High-performance field verification in <2 seconds. Documentation: govchain.us"
        },
        twitter: [
          "1/ Federal supply chains are vulnerable to credential forgery. GovChain just fixed it.",
          "2/ Using W3C Verifiable Credentials and FIPS 140-2 HSM security to anchor sovereign truth.",
          "3/ Verified by CAGE Code 1PUJ6. Secure your federal document pipeline: govchain.us 🏛️"
        ]
      };
    }

    return {
      linkedin: `🚀 AuthiChain is officially launching the MedTech Compliance Vertical.\n\nMedical device manufacturers can now automate ISO 13485 audit trails on-chain, reducing manual compliance labor by 80%. Stop managing recalls with spreadsheets—switch to cryptographic finality.\n\nQuantify your Year 1 savings here: authichain.com/roi-calculator\n\n#MedTech #Blockchain #Compliance #ISO13485`,
      reddit: {
        title: "Automating ISO 13485 compliance with blockchain provenance",
        body: "I've been working on a protocol that anchors device SKUs to Bitcoin L1 to eliminate audit overhead. Just launched a dedicated ROI calculator for medical device manufacturers to see if it actually makes sense for their scale. Would love the community's feedback on the cryptographic approach: authichain.com/roi-calculator"
      },
      twitter: [
        "1/ MedTech manufacturers: Recalls cost $200B+ annually. Manual audits are the bottleneck.",
        "2/ AuthiChain just launched a high-ticket vertical to automate ISO 13485 provenance on-chain.",
        "3/ Quantify your Year 1 savings in <2 mins using our new ROI calculator: authichain.com/roi-calculator 🚀"
      ]
    };
  }
}
