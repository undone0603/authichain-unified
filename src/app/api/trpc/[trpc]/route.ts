import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../../../../server/routers';
import { sdk } from '../../../../../server/_core/sdk';
import { DbMissionsRepository } from '../../../../../server/missions/db-repository';
import { DbAdminRepository } from '../../../../../server/admin/db-repository';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Next.js (App Router) tRPC endpoint. When Vercel builds with framework: nextjs,
 * the Express bundle (api/server.js) that previously served /api/trpc is no longer
 * the request handler, so the Next frontend's TRPCProvider (-> /api/trpc) must be
 * served here. Mounts the same appRouter + repositories the Express context used;
 * auth reuses the cookie-based sdk.authenticateRequest.
 */
async function handler(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => {
      let user = null;
      try {
        const cookie = req.headers.get('cookie') ?? '';
        user = await sdk.authenticateRequest({ headers: { cookie } } as never);
      } catch {
        user = null;
      }
      return {
        req: { headers: Object.fromEntries(req.headers) } as never,
        res: { clearCookie: () => {}, cookie: () => {} } as never,
        user,
        missionsRepo: new DbMissionsRepository(),
        adminRepo: new DbAdminRepository(),
      };
    },
  });
}

export { handler as GET, handler as POST };
