# NSF SBIR Project Pitch, draft of 2026-11-11

**Draft. Not submitted.** The founder submits this under their own NSF login after reading every sentence, because it is a statement to a federal agency. It replaces `NSF_SBIR_Project_Pitch_Final.md`, which makes claims the company cannot support (see `OPPORTUNITY_PIPELINE_2026-11-11.md`).

Before submitting:

- Confirm the SAM.gov registration is active and the submission window is open.
- Get the Michigan SBDC Tech Team to review it. NSF allows three pitches ever for one project.
- Correct the Company and Team box if any fact in it is wrong. It says: one founder, no employees, no customer revenue, no outside investment, and no imaging specialist yet. The last sentence discloses AI assistance; keep it or reword it, but do not submit text you have not read.
- The regulation and market statements in box 3 are general and carry no figures on purpose. Add a figure only with a source you have opened.

## 1. The Technology Innovation

2452 of 3500 characters.

AuthiChain publishes signed, machine-checkable provenance records for physical products. A record is canonicalized under RFC 8785 and signed with Ed25519; its hash can be anchored on a public blockchain. Anyone can verify a record offline with our open-source verifier (authichain-verify on npm, with a Python port that passes the same 28 conformance fixtures). This part works today and is not the research.

The research is the step every digital provenance system leaves open: a valid signature proves who signed a record and that it was not altered. It does not prove that the item in a person's hand is the item the record names. A counterfeiter can copy a genuine code onto a thousand fakes, and each copy verifies. Our own verifier reports this limit explicitly on every result ("physical authenticity not inspected").

The proposed innovation is a copy-evident binding between a printed code and its signed record that needs no special hardware. At the moment a code is printed, the printing process leaves random micro-scale variation in ink spread and substrate texture. We propose to capture that variation at issuance with an ordinary phone camera, derive a compact, noise-tolerant descriptor from it, and place the descriptor inside the signed record. At verification, a second phone photo is compared with the signed descriptor. A re-printed or photographed copy carries different micro-variation and fails the comparison, while the signature check proves the descriptor itself was not replaced.

What is different from existing approaches: copy-detection patterns and physically unclonable features today generally depend on proprietary printing, controlled industrial imaging, or a vendor's online matching service. We propose descriptors that (a) survive consumer phone optics, hand-held capture and normal wear, (b) are carried in an open, offline-verifiable signed record rather than a private database, and (c) come with a measured, published error rate so a verifier, human or software agent, receives a calibrated statement of uncertainty rather than a yes or no.

If feasible, this would let a small manufacturer issue copy-evident labels from standard label printers, and let a buyer, a customs officer or an automated purchasing agent check an item offline with a phone. If it is not feasible on ordinary printers and phones, Phase I will show where it fails and why, which is a useful result for anyone considering this approach.

## 2. The Technical Objectives and Challenges

2776 of 3500 characters.

The central risk is that the signal may not exist at usable strength: micro-variation that is stable for one print across phones, lighting and wear, yet different enough between an original and a careful copy. Phase I is designed to answer that question with measurements.

Objective 1. Build a labeled dataset. Print the same codes on several common label printers (thermal transfer, inkjet, laser) and substrates. Photograph each original with a range of phones under varied light, angle, distance and focus, then again after abrasion, moisture and handling. Produce copies of each original by scan-and-reprint and by photographing a screen. Challenge: capture conditions vary far more than the signal we want to measure.

Objective 2. Derive a descriptor and matching method. Evaluate registration against the code's own geometry, then candidate descriptors of residual print texture, including learned embeddings and classical texture statistics. Challenge: the descriptor must be small enough to sit in a signed record and tolerant enough for a hand-held photo, without becoming so tolerant that a good copy matches.

Objective 3. Measure error rates honestly. Report false-accept rates for copies and false-reject rates for genuine items, per printer, substrate, phone class and wear level, with confidence intervals, on held-out prints. Success criterion for Phase I: identify at least one printer and substrate class where a copy made with consumer equipment is rejected at a rate that is useful in practice while genuine worn items are still accepted, or show with data that no such operating point exists.

Objective 4. Test against an adaptive adversary. Give an attacker the signed descriptor and the matching code, and measure whether a copy can be tuned to match. Challenge: the descriptor is public by design, so security cannot rest on keeping it secret; it has to rest on the physical difficulty of reproducing the variation.

Objective 5. Calibrated output. Extend the open verifier so a physical check returns a likelihood with stated unknowns instead of a binary verdict, and specify how that result is carried in the record format so independent implementations agree.

Known gaps in our capability, stated plainly: this work needs expertise in imaging and print forensics, and in statistical evaluation of biometric-style matchers, beyond what the company has in-house today. We would engage a university imaging or document-forensics group as a subaward or consultant, and we are seeking that partner now. Phase I funds would go mainly to dataset creation, that specialist time, and evaluation.

Phase I does not depend on blockchain performance, token mechanics or new cryptography. The signing and verification layer already exists and is open source.

## 3. The Market Opportunity

1512 of 1750 characters.

The customer is a small or mid-sized manufacturer or brand that needs a buyer to be able to check an item and cannot afford serialized security printing or a hardware tag on every unit. Today its choices are a plain QR code, which can be copied freely, or proprietary secure-print and tagging systems sold to large enterprises.

Two developments increase the need. The EU's Ecodesign for Sustainable Products Regulation introduces Digital Product Passports for product groups in phases, which puts a scannable data carrier on many more products; a carrier that can be copied onto a counterfeit invites exactly that. Separately, software agents are beginning to make purchasing decisions and need a machine-readable statement of how much a provenance claim can be trusted.

We do not yet have paying customers and make no revenue claim. Our evidence of demand is indirect: public regulation, and the existence of an established secure-print industry serving large brands. Part of Phase I is customer discovery with small manufacturers to test whether copy-evidence from standard printers changes their buying decision and at what price.

The commercial model is software: a per-label or subscription fee for issuing copy-evident records, with the verifier and record format kept open so that buyers, marketplaces and inspectors can check items without an account with us. Open verification is deliberate. A proprietary check that only the vendor can run is the main adoption barrier for the existing alternatives.

## 4. The Company and Team

1452 of 1750 characters.

AuthiChain is an early-stage company in Roscommon, Michigan, with one founder and no employees. It has no revenue from customers and no outside investment to date.

What the company has built and can demonstrate: an open-source verification protocol and reference verifier published on npm (authichain-verify 0.1.1), a Python port that passes the same 28 conformance fixtures, a published record format using RFC 8785 canonicalization and Ed25519 signatures, a record anchored on a public blockchain that anyone can check, and a live service that returns signed evidence checks to software clients with the limits of each check stated in the response.

The founder designed and built this software and operates it. The founder's strengths are software architecture, applied cryptography at the protocol level, and running production services on very low cost.

The team does not currently include a specialist in imaging science or print forensics, which the proposed research requires. We intend to fill that gap through a subaward or consulting agreement with an academic imaging or document-forensics group, and through the Michigan Small Business Development Center's technology commercialization team for proposal and commercialization guidance. We would name that research partner in a full proposal.

Parts of the company's software and this pitch were drafted with AI assistance and reviewed by the founder, who is responsible for its accuracy.
