/**
 * @file rate-limit.ts
 * @project qron-platform
 * @author AuthiChain Security Ops
 * @copyright (c) 2026 AuthiChain Inc. All rights reserved.
 */

import { createClient } from '@/utils/supabase/server';

/**
 * Simple Database-Backed Rate Limiter for AuthiChain Protocol.
 * Tracks requests by IP or User ID in the automation_logs table.
 */
export async function checkRateLimit(
  identifier: string, 
  limit: number = 60, 
  windowMinutes: number = 1
): Promise<{ ok: boolean; remaining: number }> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Query logs for recent hits from this identifier
  const { count, error } = await supabase
    .from('automation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('workflow_name', 'api_rate_limit')
    .eq('payload', identifier)
    .gt('created_at', windowStart);

  if (error) {
    console.error('[rate-limit] Query Error:', error);
    return { ok: true, remaining: limit }; // Fail open for protocol availability
  }

  const currentHits = count || 0;
  
  if (currentHits >= limit) {
    return { ok: false, remaining: 0 };
  }

  // Log this hit (Fire and forget)
  supabase
    .from('automation_logs')
    .insert({
      workflow_name: 'api_rate_limit',
      trigger_type: 'event',
      status: 'success',
      payload: identifier
    })
    .then(undefined, (err) => {
      console.error('[rate-limit] Failed to log hit:', err);
    });

  return { ok: true, remaining: limit - currentHits - 1 };
}
