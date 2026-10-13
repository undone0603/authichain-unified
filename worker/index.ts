export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'online', service: 'authichain-unified' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/trigger-agent') {
      return new Response(JSON.stringify({ status: 'triggered', endpoint: '/trigger-agent' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
