// Bounded read-only AgentZ memory. No deployments, payments, or arbitrary HTTP targets.
// D1 lease fencing and event/learning writes are atomic; no replay of side effects.
const safe = (s, n = 400) => String(s ?? "").slice(0, n);
const utcSql = (ms = Date.now()) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
const RETRY_LIMIT = 3;
const LEASE_MS = 30000;
const RETRY_MS = 5 * 60000;
const MAX_EXPIRY_MINUTES = 7 * 24 * 60;

const validTarget = (s) => {
  if (typeof s !== 'string' || s.length > 1024) throw Error('invalid target');
  const u = new URL(s);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash ||
      u.hostname !== 'github.com' || !/^\/undone0603\/authichain-unified(?:\/|$)/.test(u.pathname)) {
    throw Error('target not allowlisted');
  }
  return u.toString();
};

export async function enqueue(env, args) {
  if (!env.AGENTZ_DB) throw Error('D1 not configured');
  const target = validTarget(args?.target);
  const priority = Number.isInteger(args?.priority) ? args.priority : 50;
  if (priority < 0 || priority > 100) throw Error('priority out of range');
  const key = args?.idempotency_key;
  if (key !== undefined && (typeof key !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(key))) {
    throw Error('invalid idempotency key');
  }
  const maxAttempts = args?.max_attempts === undefined ? RETRY_LIMIT : args.max_attempts;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw Error('max_attempts out of range');
  const expiresIn = args?.expires_in_minutes;
  if (expiresIn !== undefined && (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > MAX_EXPIRY_MINUTES)) {
    throw Error('expires_in_minutes out of range');
  }
  const expiresAt = expiresIn === undefined ? null : utcSql((args?.now ?? Date.now()) + expiresIn * 60000);
  const id = crypto.randomUUID();
  const cols = "INSERT INTO agentz_tasks(id,kind,target,priority,idempotency_key,max_attempts,expires_at) VALUES (?,'public_probe',?,?,?,?,?)";
  const sql = key === undefined
    ? cols
    : cols + " ON CONFLICT(kind,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING";
  await env.AGENTZ_DB.prepare(sql).bind(id, target, priority, key ?? null, maxAttempts, expiresAt).run();
  if (key !== undefined) {
    const existing = await env.AGENTZ_DB.prepare(
      "SELECT id,target,priority,status FROM agentz_tasks WHERE kind='public_probe' AND idempotency_key=?"
    ).bind(key).first();
    if (!existing || existing.target !== target || existing.priority !== priority) {
      throw Error('idempotency key reused for different operation');
    }
    return { id: existing.id, target, priority, status: existing.status, deduplicated: existing.id !== id };
  }
  return { id, target, priority, status: 'pending', deduplicated: false };
}

export async function recent(env, args) {
  if (!env.AGENTZ_DB) throw Error('D1 not configured');
  const limit = Math.min(30, Math.max(1, Number.isInteger(args?.limit) ? args.limit : 10));
  const tasks = await env.AGENTZ_DB.prepare(
    'SELECT id,kind,target,priority,status,attempts,max_attempts,expires_at,completed_at,created_at,updated_at,last_error FROM agentz_tasks ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all();
  const events = await env.AGENTZ_DB.prepare(
    'SELECT task_id,event_type,outcome,evidence_url,detail,created_at FROM agentz_task_events ORDER BY id DESC LIMIT ?'
  ).bind(limit).all();
  const learnings = await env.AGENTZ_DB.prepare(
    'SELECT task_kind,fingerprint,outcome,strategy,observation,source_event_id,created_at FROM agentz_learnings ORDER BY id DESC LIMIT ?'
  ).bind(limit).all();
  return { tasks: tasks.results, events: events.results, learnings: learnings.results };
}

// Recovery is bounded and only requeues read-only public_probe work. An expired
// lease is *unknown*, not a verified failure or success. Guard the transition
// using claim_id, so a late old worker cannot finalize the replacement attempt.
export async function recoverLeases(env, max = 3, clock = Date.now) {
  if (!env.AGENTZ_DB) return { recovered: 0, reason: 'D1 not configured' };
  let recovered = 0;
  for (let i = 0; i < Math.min(3, Math.max(0, max)); i++) {
    const now = clock(), time = utcSql(now);
    const stale = await env.AGENTZ_DB.prepare(
      "SELECT id,attempts,max_attempts,claim_id FROM agentz_tasks WHERE status='running' AND lease_expires_at<=? ORDER BY lease_expires_at ASC LIMIT 1"
    ).bind(time).first();
    if (!stale) break;
    const next = stale.attempts >= (stale.max_attempts ?? RETRY_LIMIT) ? 'failed' : 'pending';
    const id = crypto.randomUUID();
    const detail = 'lease expired; prior public probe outcome unknown';
    const batch = await env.AGENTZ_DB.batch([
      env.AGENTZ_DB.prepare(
        "UPDATE agentz_tasks SET status=?,claim_id=NULL,lease_expires_at=NULL,updated_at=?,next_run_at=?,last_error=?,audit_marker=?,completed_at=? WHERE id=? AND status='running' AND claim_id=? AND lease_expires_at<=?"
      ).bind(next, time, utcSql(now + RETRY_MS), detail, id, next === 'failed' ? time : null, stale.id, stale.claim_id, time),
      env.AGENTZ_DB.prepare(
        "INSERT INTO agentz_task_events(task_id,event_type,outcome,evidence_url,detail,event_key) SELECT id,'lease_recovered','unknown',NULL,?,? FROM agentz_tasks WHERE id=? AND claim_id IS NULL AND audit_marker=?"
      ).bind(detail, id, stale.id, id),
    ]);
    if (batch[0]?.meta?.changes) recovered++;
  }
  return { recovered };
}

// Pending work past expires_at is closed as failed with an 'expired' event and
// is never run late. Bounded like recoverLeases; audit_marker links the event.
export async function expirePending(env, max = 3, clock = Date.now) {
  if (!env.AGENTZ_DB) return { expired: 0, reason: 'D1 not configured' };
  let expired = 0;
  for (let i = 0; i < Math.min(3, Math.max(0, max)); i++) {
    const time = utcSql(clock());
    const stale = await env.AGENTZ_DB.prepare(
      "SELECT id FROM agentz_tasks WHERE status='pending' AND expires_at IS NOT NULL AND expires_at<=? ORDER BY expires_at ASC LIMIT 1"
    ).bind(time).first();
    if (!stale) break;
    const marker = crypto.randomUUID();
    const detail = 'task expired before it ran';
    const batch = await env.AGENTZ_DB.batch([
      env.AGENTZ_DB.prepare(
        "UPDATE agentz_tasks SET status='failed',updated_at=?,completed_at=?,last_error=?,audit_marker=? WHERE id=? AND status='pending' AND expires_at<=?"
      ).bind(time, time, detail, marker, stale.id, time),
      env.AGENTZ_DB.prepare(
        "INSERT INTO agentz_task_events(task_id,event_type,outcome,evidence_url,detail,event_key) SELECT id,'expired','expired',NULL,?,? FROM agentz_tasks WHERE id=? AND status='failed' AND audit_marker=?"
      ).bind(detail, marker, stale.id, marker),
    ]);
    if (batch[0]?.meta?.changes) expired++;
  }
  return { expired };
}

export async function runQueue(env, max = 3, options = {}) {
  if (!env.AGENTZ_DB) return { processed: 0, reason: 'D1 not configured' };
  const clock = options.clock || Date.now;
  const httpFetch = options.fetch || fetch;
  const { recovered } = await recoverLeases(env, 3, clock);
  const { expired } = await expirePending(env, 3, clock);
  let processed = 0;
  for (let i = 0; i < Math.min(3, Math.max(0, max)); i++) {
    const now = clock();
    const claimId = crypto.randomUUID();
    // Atomic queue claim: two cron triggers cannot both select the same row.
    const claim = await env.AGENTZ_DB.prepare(
      "UPDATE agentz_tasks SET status='running',attempts=attempts+1,claim_id=?,lease_expires_at=?,updated_at=? WHERE id=(SELECT id FROM agentz_tasks WHERE status='pending' AND next_run_at<=? AND kind='public_probe' AND authorization_class='read_only_public' AND (expires_at IS NULL OR expires_at>?) ORDER BY priority DESC,created_at ASC LIMIT 1) AND status='pending' RETURNING id,target,attempts,max_attempts"
    ).bind(claimId, utcSql(now + LEASE_MS), utcSql(now), utcSql(now), utcSql(now)).all();
    const row = claim.results?.[0];
    if (!row) break;
    let outcome = 'success', detail = '', evidenceUrl = null;
    try {
      const target = validTarget(row.target);
      const response = await httpFetch(target, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000),
        headers: { accept: 'text/html' },
      });
      if (response.body) await response.body.cancel();
      if (response.status >= 300 && response.status < 400) throw Error('redirect refused');
      if (!response.ok) throw Error('HTTP ' + response.status);
      detail = 'GitHub public endpoint responded HTTP ' + response.status;
      evidenceUrl = target;
    } catch (e) {
      outcome = 'failure';
      detail = safe(e?.message);
    }
    const doneAt = clock();
    const status = outcome === 'success' ? 'succeeded' : row.attempts >= (row.max_attempts ?? RETRY_LIMIT) ? 'failed' : 'pending';
    const eventKey = crypto.randomUUID();
    // D1 batch is transactional. The claim_id fence prevents any late old
    // attempt from overwriting a recovered task or claiming success.
    const batch = await env.AGENTZ_DB.batch([
      env.AGENTZ_DB.prepare(
        "UPDATE agentz_tasks SET status=?,updated_at=?,next_run_at=?,claim_id=NULL,lease_expires_at=NULL,last_error=?,audit_marker=?,completed_at=? WHERE id=? AND status='running' AND claim_id=?"
      ).bind(status, utcSql(doneAt), utcSql(doneAt + RETRY_MS), outcome === 'failure' ? detail : null, eventKey, status === 'pending' ? null : utcSql(doneAt), row.id, claimId),
      env.AGENTZ_DB.prepare(
        'INSERT INTO agentz_task_events(task_id,event_type,outcome,evidence_url,detail,event_key) SELECT id,\'public_probe\',?,?,?,? FROM agentz_tasks WHERE id=? AND status=? AND claim_id IS NULL AND audit_marker=?'
      ).bind(outcome, evidenceUrl, detail, eventKey, row.id, status, eventKey),
      env.AGENTZ_DB.prepare(
        "INSERT INTO agentz_learnings(task_kind,fingerprint,outcome,strategy,observation,source_event_id) SELECT 'public_probe',?,?, 'fixed-github-read-only',?,id FROM agentz_task_events WHERE event_key=?"
      ).bind(row.target, outcome, detail, eventKey),
    ]);
    if (batch[0]?.meta?.changes) processed++;
  }
  return { processed, recovered, expired };
}
