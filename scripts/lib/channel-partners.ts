/**
 * Channel-partner shortlist for autonomous outreach.
 *
 * These are referral / implementation / already-warm partners — not end-buyer
 * cold blasts. The list is loadable via `--segment=partners` and is never
 * folded into govchain / strainchain / qron / all.
 *
 * Lives in its own module because `scripts/b2b-cold-outreach.ts` runs its
 * main routine at import time.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isRoleInboxEmail,
  type VerificationSource,
} from "../../server/outreach/send-guard";

export const CHANNEL_PARTNER_LEAD_SOURCE =
  "channel_partner_web_scan_2026-09-19";

export const CHANNEL_PARTNER_SEGMENTS = [
  "strainchain",
  "qron",
  "govchain",
] as const;

export type ChannelPartnerSegment = (typeof CHANNEL_PARTNER_SEGMENTS)[number];

export type ChannelPartnerTarget = {
  company: string;
  name: string;
  email: string;
  website?: string;
  segment: ChannelPartnerSegment;
  also_segment?: ChannelPartnerSegment;
  role: "channel_partner";
  notes: string;
  source: VerificationSource;
  phone?: string;
  inbound_warm?: boolean;
  already_connected?: boolean;
};

export type SkippedChannelPartnerResearch = {
  name: string;
  reason: string;
};

type ChannelPartnerFile = {
  source: string;
  generated: string;
  role: "channel_partner";
  note?: string;
  skipped_not_auto_send: SkippedChannelPartnerResearch[];
  partners: ChannelPartnerTarget[];
};

const DATA_FILE = "channel-partners-2026-09-19.json";

const TRUSTED_SOURCES: ReadonlySet<VerificationSource> = new Set([
  "apollo_verified",
  "reacher_verified",
  "inbound_optin",
  "confirmed_reply",
  "published_contact",
]);

function dataPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", DATA_FILE);
}

export function loadChannelPartnerFile(jsonText?: string): ChannelPartnerFile {
  const raw = jsonText ?? readFileSync(dataPath(), "utf8");
  const parsed = JSON.parse(raw) as ChannelPartnerFile;
  if (parsed.source !== CHANNEL_PARTNER_LEAD_SOURCE) {
    throw new Error(
      `channel-partner file source must be ${CHANNEL_PARTNER_LEAD_SOURCE}`
    );
  }
  if (!Array.isArray(parsed.partners) || parsed.partners.length === 0) {
    throw new Error("channel-partner file has no partners");
  }
  for (const partner of parsed.partners) {
    if (partner.role !== "channel_partner") {
      throw new Error(`${partner.company}: role must be channel_partner`);
    }
    if (!CHANNEL_PARTNER_SEGMENTS.includes(partner.segment)) {
      throw new Error(`${partner.company}: invalid segment ${partner.segment}`);
    }
    if (!partner.email || !partner.email.includes("@")) {
      throw new Error(`${partner.company}: missing email`);
    }
    if (!TRUSTED_SOURCES.has(partner.source)) {
      throw new Error(
        `${partner.company}: source ${partner.source} is not trusted`
      );
    }
  }
  return parsed;
}

const file = loadChannelPartnerFile();

/** Emailable channel partners from the 2026-09-19 web scan. */
export const CHANNEL_PARTNER_TARGETS: readonly ChannelPartnerTarget[] =
  file.partners;

/** URL-only agencies and DPP consultancies — research notes, never auto-send. */
export const SKIPPED_CHANNEL_PARTNER_RESEARCH: readonly SkippedChannelPartnerResearch[] =
  file.skipped_not_auto_send;

export function partnerSegmentRequested(segment: string): boolean {
  return segment === "partners";
}

/**
 * Fail-closed: partners are never part of `all` or a product cold segment.
 */
export function shouldLoadPartnerTargets(segment: string): boolean {
  return partnerSegmentRequested(segment);
}

export function allowPartnerLiveSends(
  env: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv
): boolean {
  return (
    env.ALLOW_PARTNER_SENDS === "true" || argv.includes("--allow-partner-sends")
  );
}

export function assertPartnerRunAllowed(opts: {
  isDryRun: boolean;
  allowLive: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (opts.isDryRun) return { ok: true };
  if (!opts.allowLive) {
    return {
      ok: false,
      message:
        "Partner segment is dry-run only unless ALLOW_PARTNER_SENDS=true (or --allow-partner-sends). Not included in govchain/strainchain/qron/all live cold sends. Live partner sends stay under MAX_LIVE_SENDS.",
    };
  }
  return { ok: true };
}

/**
 * Live-send order: Existo then ICS (published partner desks), then named
 * APEX staff, then the remaining list. Role inboxes stay eligible — the
 * send guard waives role_inbox only for this segment — but named people
 * should take a cap slot before another generic inbox if Existo/ICS skip.
 */
const PREFERRED_PARTNER_EMAILS = [
  "contact@existosolutions.com",
  "info@icsconsultingservice.com",
  "fitzpatricks@nemcworks.org",
  "mooret@nemcworks.org",
  "mcmanuss@nemcworks.org",
] as const;

export function orderPartnerTargetsForSend(
  targets: readonly ChannelPartnerTarget[]
): ChannelPartnerTarget[] {
  const rank = new Map<string, number>(
    PREFERRED_PARTNER_EMAILS.map((email, index) => [email, index])
  );
  return [...targets].sort((a, b) => {
    const aEmail = a.email.toLowerCase();
    const bEmail = b.email.toLowerCase();
    const aPreferred = rank.get(aEmail);
    const bPreferred = rank.get(bEmail);
    if (aPreferred !== undefined || bPreferred !== undefined) {
      return (aPreferred ?? 1_000) - (bPreferred ?? 1_000);
    }
    const aRole = isRoleInboxEmail(aEmail) ? 1 : 0;
    const bRole = isRoleInboxEmail(bEmail) ? 1 : 0;
    return aRole - bRole;
  });
}
