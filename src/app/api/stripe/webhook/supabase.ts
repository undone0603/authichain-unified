import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One authenticated Supabase client configuration for Stripe settlement and
// read-only runtime attestation. Do not duplicate the URL/key selection.
let client: SupabaseClient<any> | null = null;

export function getWebhookSupabase(): SupabaseClient<any> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("webhook_supabase_not_configured");
    client = createClient(url, key);
  }
  return client;
}
