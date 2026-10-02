import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_PAYLOAD_BYTES = 256 * 1024;
const ALLOWED_PULL_REQUEST_ACTIONS = new Set([
  'opened',
  'reopened',
  'closed',
  'synchronize',
]);
const FAILED = new Set(['failure', 'failed', 'error', 'timed_out', 'action_required']);
const SUCCEEDED = new Set(['success', 'neutral', 'skipped']);

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max = 200): string | null {
  return typeof value === 'string' && value.length > 0
    ? value.slice(0, max)
    : null;
}

function repoName(payload: JsonObject): string {
  const repository = isObject(payload.repository) ? payload.repository : {};
  const name = text(repository.full_name, 100);
  return name && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)
    ? name
    : 'GitHub';
}

export type SanitizedGitHubEvent = {
  workflowName: string;
  status: 'success' | 'failure' | 'running' | 'updated';
};

export function verifyGitHubSignature(
  rawBody: Uint8Array,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const provided = Buffer.from(signature.slice(7), 'hex');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function normalizeGitHubWebhook(
  eventName: string | null,
  payload: unknown
): SanitizedGitHubEvent | null {
  if (!isObject(payload) || !eventName) return null;
  const repo = repoName(payload);
  let eventType: string;
  let entity = repo;
  let status: SanitizedGitHubEvent['status'] = 'updated';

  if (eventName === 'pull_request') {
    const action = text(payload.action, 30);
    const pullRequest = isObject(payload.pull_request) ? payload.pull_request : {};
    const number = pullRequest.number;
    if (!action || !ALLOWED_PULL_REQUEST_ACTIONS.has(action) ||
        !Number.isInteger(number) || Number(number) < 1) return null;
    eventType = `pull_request.${action}`;
    entity = `${repo}#${number}`;
    status = action === 'closed' ? 'success' : 'updated';
  } else if (eventName === 'check_run') {
    const checkRun = isObject(payload.check_run) ? payload.check_run : {};
    if (text(payload.action, 30) !== 'completed') return null;
    const conclusion = text(checkRun.conclusion, 30)?.toLowerCase();
    if (!conclusion) return null;
    const pulls = Array.isArray(checkRun.pull_requests) ? checkRun.pull_requests : [];
    const firstPull = isObject(pulls[0]) ? pulls[0] : {};
    const pullNumber = firstPull.number;
    if (Number.isInteger(pullNumber) && Number(pullNumber) > 0) {
      entity = `${repo}#${pullNumber}`;
    }
    eventType = 'check_run.completed';
    status = FAILED.has(conclusion)
      ? 'failure'
      : SUCCEEDED.has(conclusion)
        ? 'success'
        : 'updated';
  } else if (eventName === 'workflow_run') {
    const workflowRun = isObject(payload.workflow_run) ? payload.workflow_run : {};
    if (text(payload.action, 30) !== 'completed') return null;
    const conclusion = text(workflowRun.conclusion, 30)?.toLowerCase();
    if (!conclusion) return null;
    eventType = 'workflow_run.completed';
    status = FAILED.has(conclusion)
      ? 'failure'
      : SUCCEEDED.has(conclusion)
        ? 'success'
        : 'updated';
  } else if (eventName === 'deployment_status') {
    const deployment = isObject(payload.deployment) ? payload.deployment : {};
    const deploymentStatus = isObject(payload.deployment_status)
      ? payload.deployment_status
      : {};
    const state = text(deploymentStatus.state, 30)?.toLowerCase();
    if (!state) return null;
    eventType = 'deployment.status';
    entity = `${repo} · ${text(deployment.environment, 60) ?? 'deployment'}`;
    status = FAILED.has(state)
      ? 'failure'
      : SUCCEEDED.has(state)
        ? 'success'
        : 'running';
  } else {
    return null;
  }

  return { workflowName: `github.${eventType}|${entity}`, status };
}

export function maxGitHubPayloadBytes() {
  return MAX_PAYLOAD_BYTES;
}
