import http from 'http';
import https from 'https';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const port = 3000;
const baseDir = process.cwd();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8'
};

// Server-side proxy — fetches NASDAQ API and relays to browser (avoids CORS)
function proxyNasdaq(path, res) {
  const opts = {
    hostname: 'api.nasdaq.com',
    path,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    rejectUnauthorized: false,
  };
  https.get(opts, upstream => {
    let body = '';
    upstream.on('data', c => body += c);
    upstream.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'max-age=120',
      });
      res.end(body);
    });
  }).on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error');
  });
}

const server = http.createServer(async (req, res) => {
  const safePath = new URL(req.url === '/' ? '/index.html' : req.url, 'http://localhost').pathname;

  // ── API proxy routes ──────────────────────────────────────────────────────
  if (safePath === '/proxy/spos') {
    return proxyNasdaq('/api/ipo/calendar?type=spo', res);
  }
  if (safePath === '/proxy/earnings') {
    const date = new URL(req.url, 'http://localhost').searchParams.get('date') || new Date().toISOString().slice(0, 10);
    return proxyNasdaq(`/api/calendar/earnings?date=${date}`, res);
  }
  if (safePath === '/proxy/yahoo') {
    const params   = new URL(req.url, 'http://localhost').searchParams;
    const symbol   = params.get('symbol')   || 'QQQ';
    const interval = params.get('interval') || '1d';
    const range    = params.get('range')    || '1y';
    const opts = {
      hostname: 'query1.finance.yahoo.com',
      path: `/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      rejectUnauthorized: false,
    };
    https.get(opts, upstream => {
      let body = '';
      upstream.on('data', c => body += c);
      upstream.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=60' });
        res.end(body);
      });
    }).on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Proxy error');
    });
    return;
  }

  // ── Static file serving ───────────────────────────────────────────────────
  try {
    const filePath = decodeURIComponent(new URL(`file://${baseDir}${safePath}`).pathname).replace(/^\/([A-Z]:)/, '$1');
    const ext = extname(filePath);
    const content = await readFile(filePath);
    const headers = { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' };
    if (safePath === '/sw.js') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Service-Worker-Allowed'] = '/';
    }
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Serving http://localhost:${port}`);
});
