'use strict';
// Fault injection only: forward to real ML V2, remove its exclusion proposals.
const http = require('http');
http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const r = await fetch(`http://ml:8005${req.url}`, { method: req.method, headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks) });
    const body = await r.json();
    if (req.url === '/interpret' && body.extracted) { body.extracted.excludedIngredients = []; body.extracted.negations = []; }
    res.writeHead(r.status, { 'content-type':'application/json' }); res.end(JSON.stringify(body));
  } catch { res.writeHead(502); res.end('{}'); }
}).listen(8015, '127.0.0.1');
