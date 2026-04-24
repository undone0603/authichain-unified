import type { Env } from '../index'

type Handler = (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>
type Route = [method: string, path: string, handler: Handler]

export async function router(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  routes: Route[]
): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  const { method } = request

  for (const [routeMethod, routePath, handler] of routes) {
    if (method === routeMethod && pathname === routePath) {
      return handler(request, env, ctx)
    }
  }

  return new Response('Not found', { status: 404 })
}
