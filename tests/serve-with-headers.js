/* tests/serve-with-headers.js — zero-dependency static server that applies the
   EXACT headers defined in vercel.json, so CSP can be proven locally before a
   production deploy (Vercel applies them server-side; python http.server does not).

   run:  node tests/serve-with-headers.js            -> http://127.0.0.1:8138/
   stop: Ctrl+C

   Nothing in the app is changed by this file; it only mirrors production
   conditions (headers + outputDirectory) for the regression browser. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'web');
/* test-only route: /tests/... exposes this harness directory (Vercel serves
   only web/, so production never sees these files; CSP still applies) */
const TEST_ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8138;
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const HEADERS = (cfg.headers || []).reduce((acc, rule) => {
  acc[rule.source] = rule.headers;
  return acc;
}, {});
const ALL = HEADERS['/(.*)'] || [];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  let base = ROOT;
  if (rel.startsWith('/tests/')) { base = TEST_ROOT; rel = rel.slice('/tests'.length); }
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
  /* cleanUrls like Vercel: /about -> /about.html */
  if (!path.extname(rel)) rel += '.html';

  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(ROOT) && !file.startsWith(TEST_ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    const headers = { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
    for (const h of ALL) headers[h.key] = h.value;
    res.writeHead(200, headers);
    res.end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serve-with-headers: http://127.0.0.1:${PORT}/  (headers from vercel.json)`);
  console.log('CSP:', (ALL.find(h => h.key === 'Content-Security-Policy') || {}).value || 'none');
});
