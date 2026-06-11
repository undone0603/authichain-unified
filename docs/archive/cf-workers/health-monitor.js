--dc4cbef10f187909be779900bb2bbc06bd455aff4156b43552c0d58c31c1
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.ts
var CHECKS = [
  {
    name: "authichain.com landing reachable",
    fn: /* @__PURE__ */ __name(async () => {
      const r = await fetch("https://authichain.com/", { method: "HEAD" });
      if (!r.ok) throw new Error(`status ${r.status}`);
    }, "fn")
  },
  {
    name: "qron.space landing reachable",
    fn: /* @__PURE__ */ __name(async () => {
      const r = await fetch("https://qron.space/", { method: "HEAD" });
      if (!r.ok) throw new Error(`status ${r.status}`);
    }, "fn")
  },
  {
    name: "authichain /lead endpoint responds",
    fn: /* @__PURE__ */ __name(async () => {
      const r = await fetch("https://authichain.com/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json"
      });
      if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
    }, "fn")
  },
  {
    name: "Stripe API authenticated",
    fn: /* @__PURE__ */ __name(async (env) => {
      const r = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
      });
      if (!r.ok) throw new Error(`stripe ${r.status}`);
    }, "fn")
  }
];
var index_default = {
  async scheduled(_ev, env, ctx) {
    ctx.waitUntil(runChecks(env));
  },
  async fetch(_req, env) {
    const results = await runChecks(env);
    return new Response(JSON.stringify(results, null, 2), {
      headers: { "content-type": "application/json" }
    });
  }
};
async function runChecks(env) {
  const results = [];
  for (const c of CHECKS) {
    try {
      await c.fn(env);
      results.push({ name: c.name, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name: c.name, ok: false, error: msg });
      await maybeAlert(env, c.name, msg);
    }
  }
  return results;
}
__name(runChecks, "runChecks");
async function maybeAlert(env, name, error) {
  const key = `alert:${name}`;
  const seen = await env.ALERT_DEDUP.get(key);
  if (seen) return;
  await env.ALERT_DEDUP.put(key, "1", { expirationTtl: 60 * 60 });
  console.error(`ALERT: ${name} \u2014 ${error}`);
  if (!env.SLACK_WEBHOOK_URL) return;
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: `:rotating_light: AuthiChain/QRON health check failed
*${name}*
\`${error}\``
    })
  });
}
__name(maybeAlert, "maybeAlert");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--dc4cbef10f187909be779900bb2bbc06bd455aff4156b43552c0d58c31c1--
