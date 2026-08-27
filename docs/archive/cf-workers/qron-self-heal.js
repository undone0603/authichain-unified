--58ced0d4a36f3db085a1213bb026545adf60ce1ebdb646b0be1b3602d1db
Content-Disposition: form-data; name="index.js"

// qron-self-heal v2.1 — Health monitor with correct endpoints
let   GMAIL = "https://gmail-relay.undone-k.workers.dev/emails";
const CORS = {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"};

const CHECKS = [
  {url:"https://www.qron.space/api/health",          name:"qron-checkout"},
  {url:"https://api.qron.space/health",              name:"qron-api-gateway"},
  {url:"https://www.authichain.com/api/v1/health",   name:"authichain-api"},
  {url:"https://www.authichain.com/api/health",      name:"authichain-unified"},
  {url:"https://api.strainchain.io/health",          name:"strainchain-api"},
  {url:"https://strainchain.io",                     name:"strainchain-home"},
  {url:"https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1/stripe-webhook", name:"stripe-webhook"},
  {url:"https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1/performance-cascade", name:"performance-cascade"},
];

async function checkWorker(check) {
  const t0 = Date.now();
  try {
    const r = await fetch(check.url, {signal:AbortSignal.timeout(8000), redirect:"follow"});
    return {name:check.name, ok:r.status<400, status:r.status, ms:Date.now()-t0};
  } catch(e) {
    return {name:check.name, ok:false, status:0, ms:Date.now()-t0, error:e.message};
  }
}

async function runHealing(env) {
    if (env.GMAIL_RELAY_URL) GMAIL = env.GMAIL_RELAY_URL;
  const results = await Promise.all(CHECKS.map(checkWorker));
  const failing = results.filter(r => !r.ok);

  const alertKey = "heal_" + failing.map(f => f.name).sort().join("_");
  if (failing.length > 0 && env.OUTREACH_KV) {
    const already = await env.OUTREACH_KV.get(alertKey).catch(() => null);
    if (!already) {
      await env.OUTREACH_KV.put(alertKey, "1", {expirationTtl: 3600});
      const failText = failing.map(f => f.name + ": HTTP " + f.status + " " + (f.error || "")).join("\n");
      const allText = results.map(r => (r.ok ? "OK" : "FAIL") + " " + r.name + " " + r.status + " " + r.ms + "ms").join("\n");
      await fetch(GMAIL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          from: "Self-Heal <ops@qron.space>",
          to: "authichain@gmail.com",
          reply_to: "authichain@gmail.com",
          subject: "WORKER DOWN: " + failing.map(f => f.name).join(", "),
          text: "Self-heal alert:\n\n" + failText + "\n\nAll:\n" + allText
        })
      }).catch(() => {});
    }
  }

  if (env.OUTREACH_KV) {
    await env.OUTREACH_KV.put("last_heal_check", JSON.stringify({
      ts: Date.now(), results, failing_count: failing.length
    }), {expirationTtl: 3600});
  }

  return {results, failing_count: failing.length, all_healthy: failing.length === 0};
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runHealing(env));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/check") {
      const result = await runHealing(env);
      return Response.json(result, {headers: CORS});
    }
    const last = env.OUTREACH_KV ? await env.OUTREACH_KV.get("last_heal_check").catch(() => null) : null;
    return Response.json({
      service: "qron-self-heal", v: "2.1", schedule: "*/30 * * * *",
      checks: CHECKS.map(c => c.name),
      last_check: last ? JSON.parse(last) : null
    }, {headers: CORS});
  }
};

--58ced0d4a36f3db085a1213bb026545adf60ce1ebdb646b0be1b3602d1db--
