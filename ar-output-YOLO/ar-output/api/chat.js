// api/chat.js — Vercel Serverless Function
// Two modes:
//   1. body.localEndpoint set → proxy server-side to that URL (e.g. ngrok → local Ollama)
//      This bypasses all browser CORS/ngrok-interstitial issues.
//   2. No localEndpoint → call NVIDIA NIM API with server-side key.
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
    const body = req.body;
    const localEndpoint = body.localEndpoint;
    delete body.localEndpoint;

    // ── Mode 1: proxy to user's local model via ngrok ──────────
    if (localEndpoint) {
      const upstream = await fetch(localEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(body),
      });
      const data = await upstream.json();
      return res.status(upstream.ok ? 200 : upstream.status).json(data);
    }

    // ── Mode 2: NVIDIA NIM cloud API ───────────────────────────
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'NVIDIA_API_KEY not set. Add it in Vercel → Settings → Environment Variables.'
      });
    }
    const cleanKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;

    body.model = body.model || 'qwen/qwen2.5-7b-instruct';
    delete body.stream;

    const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return res.status(upstream.ok ? 200 : upstream.status).json(data);

  } catch (err) {
    console.error('[api/chat]', err);
    return res.status(500).json({ error: err.message });
  }
}
