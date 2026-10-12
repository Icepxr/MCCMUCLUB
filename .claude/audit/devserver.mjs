// Local Vercel-like server for the pre-deploy audit (.claude/audit — test tooling, not site source).
// - serves the project root statically with cleanUrls + trailingSlash:false like vercel.json
// - routes /data and /api/data to the real api/data.js edge handler (Web Request/Response)
// - mirrors vercel.json Cache-Control headers
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = Number(process.argv[3] || 8900);
process.env.DATA_SOURCE ||= 'supabase';
{ // public anon config, same values the browser already ships (admin/config.js)
  const cfg = await readFile(path.join(ROOT, 'admin/config.js'), 'utf8');
  process.env.SUPABASE_URL ||= (cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
  process.env.SUPABASE_ANON_KEY ||= (cfg.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1];
}
const handler = (await import(pathToFileURL(path.join(ROOT, 'api/data.js')).href)).default;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
function cacheFor(p) {
  if (p.endsWith('.html')) return 'public, max-age=0, must-revalidate';
  if (/^\/assets\/photo\//.test(p) || /^\/assets\/.*\.(png|jpe?g|svg|webp|gif|ico)$/.test(p)) return 'public, max-age=2592000, stale-while-revalidate=2592000';
  if (/^\/assets\/.*\.(css|js)$/.test(p)) return 'public, max-age=600, stale-while-revalidate=604800';
  return null;
}
const isFile = async (f) => { try { return (await stat(f)).isFile(); } catch { return false; } };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let p = decodeURIComponent(url.pathname);
  try {
    if (p === '/data' || p === '/api/data') {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : req;
      const r = await handler(new Request(url, { method: req.method, headers: req.headers, body, duplex: 'half' }));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    if (p.length > 1 && p.endsWith('/')) { res.writeHead(308, { location: p.slice(0, -1) + url.search }); return res.end(); }
    if (p.endsWith('.html')) {                       // cleanUrls: /x.html -> /x
      const clean = p === '/index.html' ? '/' : p.replace(/\/index\.html$/, '').replace(/\.html$/, '');
      res.writeHead(308, { location: clean + url.search }); return res.end();
    }
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (p === '/') file = path.join(ROOT, 'index.html');
    else if (!(await isFile(file))) {
      if (await isFile(file + '.html')) file += '.html';
      else if (await isFile(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
      else { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<h1>404 Not Found</h1>'); }
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'content-type': TYPES[ext] || 'application/octet-stream' };
    const cc = cacheFor(path.relative(ROOT, file).replace(/^/, '/'));
    if (cc) headers['cache-control'] = cc;
    res.writeHead(200, headers);
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end('dev server error: ' + e.message);
  }
}).listen(PORT, () => console.log(`audit dev server on http://localhost:${PORT} (DATA_SOURCE=${process.env.DATA_SOURCE})`));
