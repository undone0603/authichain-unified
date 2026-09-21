import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { isAgentzRequest, type FoundersActor } from "./agentz-auth";

export type FoundersAccess =
  | { ok: true; actor: FoundersActor; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; status: number; error: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key);
}

export async function resolveFoundersAccess(request?: Request): Promise<FoundersAccess> {
  if (request && isAgentzRequest(request.headers)) {
    const supabase = adminClient();
    if (!supabase) return { ok: false, status: 503, error: "Supabase admin not configured" };
    return { ok: true, actor: "agentz", supabase: supabase as Awaited<ReturnType<typeof createClient>> };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true, actor: "founder", supabase };
}
