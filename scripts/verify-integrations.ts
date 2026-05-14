/**
 * Smoke-tests every connected-account integration with a single read-only call.
 * Exits 0 if every check that has credentials passes; 1 if any configured check fails.
 * Missing env vars are reported as SKIP (yellow), not failure.
 *
 * Usage:
 *   npm run verify:integrations
 */
import 'dotenv/config';

type Status = 'ok' | 'fail' | 'skip';
interface Result {
  name: string;
  status: Status;
  detail: string;
}

const results: Result[] = [];

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

async function run(name: string, requiredEnv: string[], fn: () => Promise<string>) {
  const missing = requiredEnv.filter((k) => !process.env[k]);
  if (missing.length) {
    results.push({ name, status: 'skip', detail: `missing env: ${missing.join(', ')}` });
    return;
  }
  try {
    const detail = await fn();
    results.push({ name, status: 'ok', detail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, status: 'fail', detail: msg });
  }
}

async function main() {
  console.log(c.bold('\nVerifying connected-account integrations...\n'));

  // --- Supabase QRON (anon) ---
  await run('Supabase QRON (anon)', ['SUPABASE_ANON_KEY'], async () => {
    const { getSupabase } = await import('../libs/integrations/supabase');
    const sb = getSupabase();
    const { error } = await sb.auth.getSession();
    if (error) throw new Error(error.message);
    return 'auth.getSession OK';
  });

  // --- Supabase QRON (service_role) ---
  await run('Supabase QRON (service_role)', ['SUPABASE_SERVICE_KEY'], async () => {
    const { getSupabaseAdmin } = await import('../libs/integrations/supabase');
    const sb = getSupabaseAdmin();
    // listUsers with page size 1 — safe, admin-only read
    const { error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw new Error(error.message);
    return 'auth.admin.listUsers OK';
  });

  // --- Supabase AuthiChain (MI, service_role) ---
  await run('Supabase AuthiChain (MI)', ['SUPABASE_MI_URL', 'SUPABASE_MI_SERVICE_KEY'], async () => {
    const { getSupabaseAuthiChainAdmin } = await import('../libs/integrations/supabase');
    const sb = getSupabaseAuthiChainAdmin();
    const { error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw new Error(error.message);
    return 'auth.admin.listUsers OK';
  });

  // --- Notion ---
  await run('Notion', ['NOTION_API_KEY'], async () => {
    const { getNotion } = await import('../libs/integrations/notion');
    const me = await getNotion().users.me({});
    return `bot: ${me?.name || me?.id || 'unknown'}`;
  });

  // --- Airtable ---
  await run('Airtable', ['AIRTABLE_API_KEY'], async () => {
    const { getOpsChecklistTable } = await import('../libs/integrations/airtable');
    const recs = await getOpsChecklistTable().select({ maxRecords: 1 }).firstPage();
    return `read ${recs.length} record`;
  });

  // --- Vercel ---
  await run('Vercel (qron-platform)', ['VERCEL_TOKEN'], async () => {
    const { getQronDeployments } = await import('../libs/integrations/vercel');
    const data = await getQronDeployments(1);
    const n = Array.isArray(data?.deployments) ? data.deployments.length : 0;
    return `fetched ${n} deployment`;
  });

  // --- Print summary ---
  console.log(c.bold('Results:'));
  for (const r of results) {
    const tag =
      r.status === 'ok' ? c.green('  PASS') : r.status === 'fail' ? c.red('  FAIL') : c.yellow('  SKIP');
    console.log(`${tag}  ${r.name.padEnd(34)} ${c.dim(r.detail)}`);
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const skip = results.filter((r) => r.status === 'skip').length;
  console.log(
    `\n${c.bold('Summary:')} ${c.green(String(ok) + ' ok')}  ${c.red(String(fail) + ' fail')}  ${c.yellow(String(skip) + ' skip')}\n`,
  );

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(c.red('verify-integrations crashed:'), err);
  process.exit(2);
});
