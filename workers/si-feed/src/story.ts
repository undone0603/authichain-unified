import type { SiEvent } from "./types";

export type ClaimKind = "observed" | "derived" | "interpreted" | "projected" | "unknown";

export interface StoryClaim {
  story_id: string;
  claim: string;
  kind: ClaimKind;
  evidence: string[];
  confidence: "verified" | "inferred" | "hypothesis" | "insufficient";
  generated_by: "StoryMode";
}

export function assembleStory(entity: string, events: SiEvent[]) {
  const story_id = `story_${entity.replace(/[^a-zA-Z0-9:_-]/g, "_")}`;
  const ordered = [...events].sort((a, b) => a.ts.localeCompare(b.ts));
  const observed: StoryClaim[] = ordered.map((e) => ({
    story_id,
    claim: e.summary,
    kind: "observed",
    evidence: [e.id],
    confidence: "verified",
    generated_by: "StoryMode",
  }));
  const derived: StoryClaim[] = [];
  const lookups = ordered.filter((e) => e.type === "verify.lookup" || e.type === "attestation.recorded" || e.type === "verify.record");
  if (lookups.length >= 1 && ordered.length >= 2) {
    derived.push({
      story_id,
      claim: "A stored record was later presented. The presentation does not re-attest the item and is not a passport.",
      kind: "derived",
      evidence: [lookups[0].id, ordered[ordered.length - 1].id],
      confidence: "inferred",
      generated_by: "StoryMode",
    });
  }
  return { story_id, observed, derived };
}

export function publicClaims(entity: string, events: SiEvent[]): StoryClaim[] {
  const story = assembleStory(entity, events);
  return [...story.observed, ...story.derived].filter(
    (c) => (c.kind === "observed" || c.kind === "derived") && c.evidence.length > 0,
  );
}
