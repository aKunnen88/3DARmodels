// Local development server — serves ar-output/ and proxies /api/chat to Ollama.
// Run with: node local-server.js
// Then open: http://192.168.0.142:3001 on any device on the same WiFi.
//
// This avoids the HTTPS→HTTP mixed-content block you get on the Vercel deployment.

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT        = 3001;
const STATIC_DIR  = path.join(__dirname, 'ar-output');
const OLLAMA_URL  = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_MODEL = 'qwen2.5:3b';

const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mind': 'application/octet-stream',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Required for SharedArrayBuffer / MindAR WASM
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
}

function serveStatic(req, res) {
  let filePath = path.join(STATIC_DIR, url.parse(req.url).pathname);
  if (filePath.endsWith('/') || !path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyChat(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = {}; }
    parsed.model  = parsed.model || OLLAMA_MODEL;
    parsed.stream = true; // always stream from Ollama

    const payload = JSON.stringify(parsed);
    const ollamaReq = http.request(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, ollamaRes => {
      cors(res);
      // Pipe the SSE stream straight through to the caller
      res.writeHead(ollamaRes.statusCode, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      ollamaRes.pipe(res);
    });

    ollamaReq.on('error', err => {
      cors(res);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Ollama unreachable: ${err.message}. Is Ollama running?` }));
    });

    ollamaReq.write(payload);
    ollamaReq.end();
  });
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url.startsWith('/api/chat') && req.method === 'POST') {
    proxyChat(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Local AR server running:`);
  console.log(`  → This machine : http://localhost:${PORT}`);
  console.log(`  → Phone / tablet: http://192.168.0.142:${PORT}`);
  console.log(`\n  Proxying AI requests to Ollama at ${OLLAMA_URL}`);
  console.log(`  Model: ${OLLAMA_MODEL}\n`);
});
