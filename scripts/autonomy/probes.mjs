// scripts/autonomy/probes.mjs
//
// The public probes that say "production is up". Shared by ops-pulse (GitHub
// Actions) and workers/ops-sentinel (Cloudflare cron), so the backstop that
// runs when Actions cannot checks exactly the same things. No imports: this
// file must load in both Node and a Worker.

export const PROBES = [
  { name: "authichain.com", url: "https://authichain.com/", expect: [200] },
  {
    name: "authichain.com pricing",
    url: "https://authichain.com/pricing",
    expect: [200],
  },
  {
    name: "authichain.com API health",
    url: "https://authichain.com/api/health",
    expect: [200],
  },
  {
    name: "authichain.com real 404",
    url: "https://authichain.com/__pulse_missing__",
    expect: [404],
  },
  { name: "qron.space", url: "https://qron.space/", expect: [200] },
  { name: "strainchain.io", url: "https://strainchain.io/", expect: [200] },
  { name: "govchain.us", url: "https://govchain.us/", expect: [200] },
  {
    name: "govchain.us opportunities",
    url: "https://govchain.us/opportunities",
    expect: [200],
  },
];

/** Probes each URL; a failure is retried once after retryDelayMs so a single blip never pages anyone. */
export async function runProbes(
  probes = PROBES,
  { fetchImpl = fetch, timeoutMs = 15_000, retryDelayMs = 5_000 } = {}
) {
  const first = await probeAll(probes, { fetchImpl, timeoutMs });
  const failed = first.filter(r => !r.ok);
  if (!failed.length) return first;
  await new Promise(r => setTimeout(r, retryDelayMs));
  const retried = new Map(
    (await probeAll(failed, { fetchImpl, timeoutMs })).map(r => [r.url, r])
  );
  return first.map(r => retried.get(r.url) ?? r);
}

async function probeAll(probes, { fetchImpl, timeoutMs }) {
  return Promise.all(
    probes.map(async p => {
      const t0 = Date.now();
      try {
        const res = await fetchImpl(p.url, {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        const ok = p.expect.includes(res.status);
        return { ...p, status: res.status, ms: Date.now() - t0, ok };
      } catch (e) {
        return {
          ...p,
          status: 0,
          ms: Date.now() - t0,
          ok: false,
          error: String(e.message ?? e),
        };
      }
    })
  );
}
