import { parseGS1DigitalLink } from '../../protocol/src/gs1-extended-parser';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/01/')) {
      const parsedGS1 = parseGS1DigitalLink(url);
      if (!parsedGS1) {
        return new Response('Invalid GS1 Digital Link', { status: 400 });
      }

      // 1. Check Cloudflare Edge Cache
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      let response = await cache.match(cacheKey);

      if (!response) {
        // 2. Cache Miss: Mock D1 Resolution (Replace with actual DB binding)
        const identity = { 
          gtin: parsedGS1.gtin, 
          status: 'verified',
          cachedAt: new Date().toISOString() 
        };

        response = new Response(JSON.stringify(identity), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300'
          }
        });
        
        // 3. Store in Edge Cache asynchronously 
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return response;
    }

    return new Response('AuthiChain Edge API', { status: 200 });
  }
}
