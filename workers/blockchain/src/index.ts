// Scaffolded — not yet deployed. Placeholder so wrangler.toml resolves correctly.
// TODO: implement Polygon RPC integration (read block data, verify tx, etc.)
export default {
  async fetch(_req: Request): Promise<Response> {
    return Response.json({ error: 'not_implemented' }, { status: 501 });
  },
};
