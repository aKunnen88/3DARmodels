// api/chat.js — Vercel Serverless Function
// Proxies LLM requests to NVIDIA API using a server-side API key.
// Deployed automatically by Vercel when this file exists at /api/chat.js
//
// Set this in Vercel Dashboard → Project Settings → Environment Variables:
//   NVIDIA_API_KEY = nvapi-xxxxxxxxxxxx (without "Bearer ")

export default async function handler(req, res) {
  // CORS headers — allow the browser to call this from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'NVIDIA_API_KEY not set. Add it in Vercel → Settings → Environment Variables.'
    });
  }

  // Strip accidental "Bearer " prefix from the env var
  const cleanKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;

  try {
    const body = req.body;

    // Override model to a fast, free NVIDIA-hosted model
    body.model = body.model || 'meta/llama-3.1-8b-instruct';
    // Remove keys Ollama adds that NVIDIA doesn't support
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

    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[api/chat]', err);
    return res.status(500).json({ error: err.message });
  }
}
