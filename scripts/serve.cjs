/**
 * serve.cjs
 * Zero-dependency static server for the prototype.
 *
 * The prototype is built to run from a double-clicked file:// URL, so this is
 * optional. Use it when you want a real http:// origin:
 *
 *   - sharing over the local network for a demo on the clinic's own iPad
 *   - anything that needs a proper origin (service workers, clipboard API)
 *   - checking the mobile layout on an actual phone
 *
 * Run:  node scripts/serve.cjs           (http://localhost:4173)
 *       node scripts/serve.cjs 8080       (custom port)
 *
 * Binds all interfaces so a phone on the same wifi can reach it. It sends
 * noindex headers and refuses to serve anything outside prototype/, but it is
 * a demo server: do not expose it to the internet, and there is no real patient
 * data in here to expose anyway.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', 'prototype');
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const file = path.join(ROOT, urlPath);

  // Never serve outside prototype/. path.join collapses ".." before we compare.
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<pre style="font:14px system-ui;padding:2rem">404 — ' + urlPath +
        '\n\nIf this is demo-data.js, generate it first:\n  node scripts/generate-fixtures.cjs</pre>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets).flat()
    .filter(n => n && n.family === 'IPv4' && !n.internal)
    .map(n => n.address);

  console.log('\n  Gameday Thornton pilot — PILOT MODE, synthetic data only\n');
  console.log('  Local:   http://localhost:' + PORT);
  lan.forEach(ip => console.log('  Network: http://' + ip + ':' + PORT + '   (phones on this wifi)'));
  console.log('\n  Serving: ' + ROOT);
  console.log('  Stop:    Ctrl+C\n');

  if (!fs.existsSync(path.join(ROOT, 'demo-data.js'))) {
    console.log('  ⚠  demo-data.js is missing. Run: node scripts/generate-fixtures.cjs\n');
  }
});
