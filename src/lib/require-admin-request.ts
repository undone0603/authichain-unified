import { NextResponse } from "next/server";
import { createClient } from "../utils/supabase/server";
import { checkAdminKey } from "./admin-key";
import { requireAdmin } from "./require-admin";

/**
 * Owner-only gate for API routes: ADMIN_DASHBOARD_KEY (header) or the
 * founder's Supabase session (ADMIN_EMAIL). Same order as
 * src/app/api/admin/revenue/route.ts. Returns null when allowed, otherwise
 * the 401/403 response to return.
 */
export async function requireAdminRequest(
  request: Request
): Promise<NextResponse | null> {
  if (checkAdminKey(request)) return null;
  const result = await requireAdmin(await createClient());
  return result instanceof NextResponse ? result : null;
}
