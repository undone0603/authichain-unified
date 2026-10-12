import { verify } from 'jsonwebtoken';

export async function tokenGateMiddleware(request: Request, env: any) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, env.JWT_SECRET);
    const { results } = await env.DB.prepare(`SELECT tier FROM portal_entitlements WHERE wallet_address = ? AND tier = 'pilot-access'`).bind(decoded.wallet).all();
    
    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'Wallet does not hold required pilot entitlements' }), { status: 403 });
    }

    const modifiedRequest = new Request(request);
    modifiedRequest.headers.set('x-verified-wallet', decoded.wallet);
    return modifiedRequest;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Token verification failed' }), { status: 403 });
  }
}
