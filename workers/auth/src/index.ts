export interface Env {
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Minimal Edge JWT verification (using Web Crypto API)
async function verifyJWT(token: string, secret: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const data = enc.encode(parts[0] + '.' + parts[1]);
    const signature = new Uint8Array(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/'))
        .split('').map(c => c.charCodeAt(0))
    );

    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!isValid) return null;

    return JSON.parse(atob(parts[1]));
  } catch (e) {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    if (request.method !== "POST" || url.pathname !== "/api/auth/verify") {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), { status: 401 });
      }

      const token = authHeader.split(" ")[1];
      const payload = await verifyJWT(token, env.JWT_SECRET);

      if (!payload) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
      }

      return new Response(JSON.stringify({
        valid: true,
        user: payload,
        permissions: payload.role || 'user'
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error: any) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 500 });
    }
  }
};
