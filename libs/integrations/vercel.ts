// Lightweight Vercel REST helper. Optional VERCEL_TOKEN enables programmatic deploys/lookups.
// Project IDs and team ID are read from env so the same code works for QRON and AuthiChain projects.
export const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';
export const VERCEL_PROJECT_ID_QRON = process.env.VERCEL_PROJECT_ID_QRON || '';
export const VERCEL_PROJECT_ID_AUTHICHAIN = process.env.VERCEL_PROJECT_ID_AUTHICHAIN || '';
export const VERCEL_TEAM_SLUG = 'authichain-6389s-projects';
export const VERCEL_PROJECT_SLUG_QRON = 'qron-platform';

const TOKEN = process.env.VERCEL_TOKEN || '';

function qs(params: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : '';
}

export async function vercelFetch(path: string, init: RequestInit = {}) {
  if (!TOKEN) throw new Error('[vercel] Missing VERCEL_TOKEN in environment');
  const url = `https://api.vercel.com${path}${path.includes('?') ? '&' : ''}${VERCEL_TEAM_ID ? `teamId=${VERCEL_TEAM_ID}` : ''}`.replace(/[?&]$/, '');
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`[vercel] ${res.status} ${res.statusText} on ${path}`);
  return res.json();
}

export async function getQronDeployments(limit = 10) {
  return vercelFetch(`/v6/deployments${qs({ projectId: VERCEL_PROJECT_ID_QRON, limit: String(limit) })}`);
}
