export type SealStatus =
  | "issued"
  | "active"
  | "clone_suspected"
  | "cloned"
  | "revoked"
  | "not_found";

export type ScanEvent = {
  country: string;
  region?: string;
  at: number;
};

export type CloneConfig = {
  suspectRegions: number;
  cloneRegions: number;
  windowMs: number;
  hardCloneScans: number;
};

export const DEFAULT_CLONE_CONFIG: CloneConfig = {
  suspectRegions: 3,
  cloneRegions: 5,
  windowMs: 6 * 60 * 60 * 1000,
  hardCloneScans: 12,
};

export type Transition = {
  next: SealStatus;
  reason: string;
  score: number;
};

export function regionKey(event: ScanEvent): string {
  const country = (event.country || "ZZ").toUpperCase().slice(0, 2);
  const region = (event.region || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return region ? `${country}-${region}` : country;
}

export function scoreBurst(history: ScanEvent[], now: number, cfg = DEFAULT_CLONE_CONFIG) {
  const windowed = history.filter((e) => now - e.at <= cfg.windowMs);
  const regions = new Set(windowed.map(regionKey));
  return {
    windowedScans: windowed.length,
    distinctRegions: regions.size,
    regions: [...regions],
  };
}

export function nextStatus(
  current: SealStatus,
  history: ScanEvent[],
  incoming: ScanEvent,
  cfg = DEFAULT_CLONE_CONFIG,
): Transition {
  if (current === "revoked") return { next: "revoked", reason: "seal_revoked", score: 1 };
  if (current === "cloned") return { next: "cloned", reason: "already_cloned", score: 1 };
  if (current === "not_found") return { next: "not_found", reason: "unknown_seal", score: 0 };
  if (current === "issued") return { next: "active", reason: "first_activation", score: 0 };

  const all = [...history, incoming];
  const burst = scoreBurst(all, incoming.at, cfg);

  if (burst.distinctRegions >= cfg.cloneRegions || burst.windowedScans >= cfg.hardCloneScans) {
    return {
      next: "cloned",
      reason: `velocity:${burst.distinctRegions}r/${burst.windowedScans}s`,
      score: 0.95,
    };
  }

  if (burst.distinctRegions >= cfg.suspectRegions) {
    return {
      next: "clone_suspected",
      reason: `multi_region:${burst.regions.join(",")}`,
      score: 0.7,
    };
  }

  return {
    next: current === "clone_suspected" ? "clone_suspected" : "active",
    reason: "consistent",
    score: burst.distinctRegions > 1 ? 0.25 : 0,
  };
}

export const STATUS_COPY: Record<SealStatus, { label: string; proves: string; doesNot: string }> = {
  issued: {
    label: "Issued — not yet activated",
    proves: "A certificate exists. The physical unit has not recorded a first scan.",
    doesNot: "Does not prove the item in hand is the only copy of this code.",
  },
  active: {
    label: "Authentic",
    proves: "This identifier is registered and scan pattern is consistent with a single unit.",
    doesNot: "Does not prove manufacturing quality, lab results, or chain-of-custody beyond what the issuer attached.",
  },
  clone_suspected: {
    label: "Clone suspected",
    proves: "The same identifier is appearing in multiple regions in a short window.",
    doesNot: "Not a courtroom finding. Treat as a risk flag and inspect the item.",
  },
  cloned: {
    label: "Cloned or diverted",
    proves: "Scan velocity or region fan-out exceeds a single-unit pattern.",
    doesNot: "Does not identify which scan was the original unit.",
  },
  revoked: {
    label: "Revoked",
    proves: "The issuer invalidated this seal.",
    doesNot: "Does not explain why. Contact the brand.",
  },
  not_found: {
    label: "Not found",
    proves: "Nothing. This identifier is not in the registry.",
    doesNot: "Absence here is not proof of counterfeit by itself — it may be an unregistered genuine item.",
  },
};
