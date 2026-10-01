/**
 * Resolve the profiles row for a signed-in Supabase user.
 *
 * profiles is the entitlement record the live Stripe webhook maintains
 * (provisioning.ts). Checkout creates guest profiles keyed by email with no
 * auth user id, and login is by emailed magic link, so after trying the auth
 * user id we fall back to the verified, lowercased email: that is how a buyer
 * claims a purchase made before they had an account.
 */

// Loose on purpose, like provisioning.ts: callers pass the service-role client
// and tests pass a fake.
type ProfilesClient = {
  from: (table: "profiles") => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export async function findProfileForUser<T>(
  admin: ProfilesClient,
  user: { id: string; email?: string | null },
  columns: string
): Promise<T | null> {
  const byUser = await admin
    .from("profiles")
    .select(columns)
    .eq("user_id", user.id)
    .limit(1);
  if (byUser?.data?.[0]) return byUser.data[0] as T;

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;
  const byEmail = await admin
    .from("profiles")
    .select(columns)
    .eq("email", email)
    .limit(1);
  return (byEmail?.data?.[0] as T | undefined) ?? null;
}
