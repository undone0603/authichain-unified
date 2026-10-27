import { handle } from 'hono/vercel';
import app from '../src/index';

// Vercel Node.js runtime adapter; the Cloudflare Worker entry remains unchanged.
export const config = { runtime: 'nodejs' };
export default handle(app);
