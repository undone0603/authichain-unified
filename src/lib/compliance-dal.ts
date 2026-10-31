import { redirect } from "next/navigation";
import { createClient } from "../utils/supabase/server";
import {
  decideComplianceAccess,
  loadComplianceProfile,
  type ComplianceAccess,
} from "./compliance-access";
import { getSupabaseAdmin } from "./supabase-admin";

export const COMPLIANCE_PATH = "/dashboard/compliance";

/**
 * Data-access-layer gate for the compliance dashboard. Every server entry
 * point that renders or returns compliance data calls this first; it is not
 * done in a layout because layouts do not re-run on client navigation (see
 * node_modules/next/dist/docs/01-app/02-guides/authentication.md).
 *
 * Signed out -> /login. Signed in without the tier -> the upgrade page, with
 * the reason so it can say what is wrong. Never reads a client-set value.
 */
export async function requireComplianceAccess(): Promise<
  Extract<ComplianceAccess, { allowed: true }>
> {
  const session = await createClient();
  const { data } = (await session.auth?.getUser()) ?? { data: { user: null } };
  const user = data?.user;
  if (!user) redirect(`/login?next=${encodeURIComponent(COMPLIANCE_PATH)}`);

  const profile = await loadComplianceProfile(getSupabaseAdmin(), {
    id: user.id,
    email: user.email,
  });
  const access = decideComplianceAccess({
    email: user.email,
    profile,
    ownerEmail: process.env.ADMIN_EMAIL,
  });
  if (!access.allowed) {
    redirect(`/billing/upgrade-required?reason=${access.reason}`);
  }
  return access;
}
