// api/chat.js — Vercel Serverless Function
// Two modes:
//   1. body.localEndpoint set → proxy server-side to that URL (ngrok → local Ollama)
//   2. No localEndpoint       → call NVIDIA NIM API with server-side key
//
// Both modes stream the SSE response back to the browser token by token.
//
// Set in Vercel Dashboard → Settings → Environment Variables:
//   NVIDIA_API_KEY = nvapi-xxxxxxxxxxxx  (without "Bearer ")

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body          = req.body;
    const localEndpoint = body.localEndpoint;
    delete body.localEndpoint;
    body.stream = true; // always stream

    let upstreamURL, upstreamHeaders;

    if (localEndpoint) {
      // ── Mode 1: proxy to user's local model via ngrok ──────────
      upstreamURL     = localEndpoint;
      upstreamHeaders = {
        'Content-Type':               'application/json',
        'ngrok-skip-browser-warning': 'true',
      };
    } else {
      // ── Mode 2: NVIDIA NIM cloud API ───────────────────────────
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'NVIDIA_API_KEY not set. Add it in Vercel → Settings → Environment Variables.'
        });
      }
      const cleanKey  = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;
      upstreamURL     = 'https://integrate.api.nvidia.com/v1/chat/completions';
      upstreamHeaders = {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${cleanKey}`,
      };
      body.model = body.model || 'qwen/qwen2.5-7b-instruct';
    }

    const upstream = await fetch(upstreamURL, {
      method:  'POST',
      headers: upstreamHeaders,
      body:    JSON.stringify(body),
    });

    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({ error: upstream.statusText }));
      return res.status(upstream.status).json(data);
    }

    // ── Stream SSE tokens back to the browser ───────────────────
    res.setHeader('Content-Type',      'text/event-stream');
    res.setHeader('Cache-Control',     'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx proxy buffering

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      res.end();
    }

  } catch (err) {
    console.error('[api/chat]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
}
