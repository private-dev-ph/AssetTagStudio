import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const policy = fs.readFileSync(path.join(root,'_headers'),'utf8').split('\n').filter(line => line.startsWith('  ') && !line.includes('Cache-Control')).map(line => { const colon = line.indexOf(':'); return [line.slice(0,colon).trim(),line.slice(colon+1).trim()]; });
http.createServer((req,res)=>{
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type',types[path.extname(target)] || 'application/octet-stream');
  for (const [name,value] of policy) res.setHeader(name,value);
  const stream = fs.createReadStream(target);
  stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
  stream.pipe(res);
}).listen(4173,'127.0.0.1',()=>console.log('Production verification server http://127.0.0.1:4173'));
