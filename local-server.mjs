import { createServer } from 'node:http';

const server = createServer(async (req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url === '/api/scrape-passport') {
      try {
        const { targetUrl } = JSON.parse(body || '{}');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          scrapedUrl: targetUrl || 'none',
          data: { passportId: 'BAT-LOC-001', status: 'verified' } 
        }));
        return;
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Local fallback mock active', path: req.url }));
  });
});

server.listen(8787, '127.0.0.1', () => {
  console.log('Local mock server running on http://127.0.0.1:8787');
});
