import { timingSafeEqual } from 'crypto';

type RequestLike = {
  headers?: {
    get(name: string): string | null;
  };
};

function parseBearerToken(authHeader: string): string | null {
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;
  if (parts[0] !== 'Bearer') return null;
  if (!parts[1]) return null;
  return parts[1];
}

function timingSafeTokenEquals(providedToken: string, expectedToken: string): boolean {
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);

  if (provided.length !== expected.length) {
    const padded = Buffer.alloc(expected.length);
    provided.copy(padded, 0, 0, Math.min(provided.length, expected.length));
    timingSafeEqual(padded, expected);
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function isCronAuthorized(req: RequestLike): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers?.get('authorization');
  if (!authHeader) return false;

  const token = parseBearerToken(authHeader);
  if (!token) return false;

  return timingSafeTokenEquals(token, secret);
}
