import { COMPLIANCE_PLAN_ID } from "./plans";
import { findProfileForUser } from "./profile-lookup";

/**
 * Who may open /dashboard/compliance. The decision is made on the server from
 * the profiles row the Stripe webhook maintains (provisionPurchase writes
 * subscription_plan / subscription_status). Nothing the browser sends is
 * trusted: the previous gate read an `org_plan_tier` cookie, which nothing in
 * the app ever set and which anyone could set by hand.
 */

export const ENTITLED_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "trialing",
]);

export type ComplianceProfile = {
  id: string;
  subscription_plan: string | null;
  subscription_status: string | null;
};

export type ComplianceAccess =
  | { allowed: true; reason: "plan" | "owner"; profileId: string | null }
  | { allowed: false; reason: "no_profile" | "no_plan" | "inactive" };

/** Pure: the whole access rule, so it can be tested as a table. */
export function decideComplianceAccess(input: {
  email: string | null | undefined;
  profile: ComplianceProfile | null;
  ownerEmail: string | null | undefined;
}): ComplianceAccess {
  const email = input.email?.trim().toLowerCase();
  const owner = input.ownerEmail?.trim().toLowerCase();
  if (email && owner && email === owner) {
    return {
      allowed: true,
      reason: "owner",
      profileId: input.profile?.id ?? null,
    };
  }
  const profile = input.profile;
  if (!profile) return { allowed: false, reason: "no_profile" };
  if (profile.subscription_plan !== COMPLIANCE_PLAN_ID) {
    return { allowed: false, reason: "no_plan" };
  }
  if (!ENTITLED_STATUSES.has(profile.subscription_status ?? "")) {
    return { allowed: false, reason: "inactive" };
  }
  return { allowed: true, reason: "plan", profileId: profile.id };
}

const PROFILE_COLUMNS = "id, subscription_plan, subscription_status";

/** The signed-in user's entitlement fields (see profile-lookup.ts). */
export function loadComplianceProfile(
  admin: Parameters<typeof findProfileForUser>[0],
  user: { id: string; email?: string | null }
): Promise<ComplianceProfile | null> {
  return findProfileForUser<ComplianceProfile>(admin, user, PROFILE_COLUMNS);
}

/** Why the upgrade page was shown, in words a customer can act on. */
export function accessDeniedMessage(reason: string | undefined): string {
  switch (reason) {
    case "inactive":
      return "Your Enterprise Compliance subscription is not active. Update your payment method or contact us to restore access.";
    case "no_profile":
    case "no_plan":
    default:
      return "The compliance dashboard is part of the Enterprise Compliance tier, which this account does not have.";
  }
}
