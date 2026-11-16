'use strict';
// Real /interpret, intentionally unavailable /rank to exercise fallback.
const http = require('http');
http.createServer(async (req,res) => {
  if (req.url === '/rank') { res.writeHead(503); return res.end('{}'); }
  try {
    const chunks=[]; for await (const c of req) chunks.push(c);
    const r=await fetch(`http://ml:8005${req.url}`,{method:req.method,headers:{'content-type':'application/json'},body:Buffer.concat(chunks)});
    res.writeHead(r.status,{'content-type':'application/json'}); res.end(await r.text());
  } catch { res.writeHead(502); res.end('{}'); }
}).listen(8025,'127.0.0.1');
