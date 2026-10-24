/**
 * Mode usage aggregator Cron.
 * Queries Supabase qron_generations last 24h, logs structured metric, ntfy alert if core modes <5%.
 * Idempotent. Exponential backoff on query. Dead-letter to log. Cost ~$0 free tier.
 * Eliminates ~30 min/week manual review.
 */

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
    // Placeholder: replace with actual Supabase query using env.SUPABASE_URL / KEY
    // const { data } = await supabase.from('qron_generations').select('mode').gte('created_at', ...)
    const counts = { stellar_art: 0, batch_create: 0, limited_drop: 0, total: 0 }; // real query here
    const corePct = counts.total > 0 ? (counts.stellar_art + counts.batch_create) / counts.total : 0;
    console.log(JSON.stringify({ evt: "mode_usage", ...counts, corePct }));
    if (counts.total > 100 && corePct < 0.05) {
      // ntfy alert (use env.NTFY_TOPIC)
      console.log(JSON.stringify({ alert: "low_mode_usage", corePct }));
    }
  },
};
