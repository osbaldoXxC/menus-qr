'use strict';
// Transparent isolated test observer: forwards all ML work to the real V2
// service, records only request IDs and candidate IDs in memory.
const http = require('node:http');
const seen = [];
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://ml-proxy:8010');
    if (req.method === 'GET' && url.pathname === '/captured') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(seen.filter(x => x.requestId === url.searchParams.get('requestId'))));
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString('utf8');
    if (url.pathname === '/rank') {
      const data = JSON.parse(body);
      seen.push({ requestId: data.requestId, ids: data.candidates.map(c => c.id) });
      if (seen.length > 100) seen.shift();
    }
    const response = await fetch(`http://ml:8000${url.pathname}${url.search}`, {
      method: req.method, headers: { 'content-type': 'application/json' }, body: body || undefined
    });
    res.statusCode = response.status;
    res.setHeader('content-type', response.headers.get('content-type') || 'application/json');
    res.end(await response.text());
  } catch (_) { res.statusCode = 502; res.end('{}'); }
}).listen(8010, '0.0.0.0');
