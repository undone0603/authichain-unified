import { Request, Response, NextFunction } from 'express';

// Minimal logger — the full pino logger lives in mcp/dist/server/logger.js for
// the MCP server. This middleware is used by the Express app when wired; it
// falls back to console so it works without a logger dependency.
const logger = {
  info: (obj: Record<string, unknown>, msg?: string) => {
    if (msg) console.info(msg, obj);
    else console.info(obj);
  },
};

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;

  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, 'HTTP Request');
  });

  next();
}
