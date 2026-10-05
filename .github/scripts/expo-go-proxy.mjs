// In front of Metro (8081) on the GitHub runner: /open is a page a phone
// browser can open (https), with a button that hands the exp:// link to
// Expo Go. Every other request goes to Metro unchanged.
import http from 'node:http';

const HOST = process.env.HOST;
const exp = `exp://${HOST}`;
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IRLY dans Expo Go</title><style>body{font-family:system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 20px;text-align:center}
a.b{display:block;background:#000;color:#fff;padding:18px;border-radius:14px;text-decoration:none;font-size:18px;margin:24px 0}
code{word-break:break-all;background:#f2f2f2;padding:6px 8px;border-radius:6px;display:block;margin-top:8px}</style></head>
<body><h1>IRLY</h1><p>1. Installe <b>Expo Go</b> (App Store / Google Play).</p>
<a class="b" href="${exp}">2. Ouvrir IRLY dans Expo Go</a>
<p>Si rien ne se passe : ouvre Expo Go → « Enter URL manually » et colle :</p><code>${exp}</code></body></html>`;

http
  .createServer((req, res) => {
    if (req.url === '/open' || req.url === '/open/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(page);
    }
    const up = http.request({ host: '127.0.0.1', port: 8081, path: req.url, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => {
      res.writeHead(502);
      res.end('Metro is not reachable');
    });
    req.pipe(up);
  })
  .on('upgrade', (req, socket, head) => {
    // Websockets (logs, hot reload) straight through to Metro.
    const net = import('node:net').then(({ connect }) => {
      const s = connect(8081, '127.0.0.1', () => {
        s.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
        s.write(head);
        s.pipe(socket).pipe(s);
      });
      s.on('error', () => socket.destroy());
    });
    void net;
  })
  .listen(8082, () => console.log('proxy on 8082, open page at /open'));
