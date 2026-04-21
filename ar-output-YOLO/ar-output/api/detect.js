// api/detect.js — Vercel Serverless Function
// Proxies Roboflow YOLO detection — keeps the API key server-side.
//
// Set in Vercel Dashboard → Settings → Environment Variables:
//   ROBOFLOW_API_KEY = sCeSU3tBkqCWRttvc4p5

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const key   = process.env.ROBOFLOW_API_KEY;
  const model = process.env.ROBOFLOW_MODEL || 'my-first-project-iccnb/2';

  if (!key) {
    return res.status(500).json({
      error: 'ROBOFLOW_API_KEY not set in Vercel environment variables.'
    });
  }

  try {
    // Body is the raw base64 image string sent by the browser
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image field' });

    const upstream = await fetch(
      `https://detect.roboflow.com/${model}?api_key=${key}&confidence=50&overlap=30`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    image,
      }
    );

    const data = await upstream.json();
    return res.status(upstream.ok ? 200 : upstream.status).json(data);

  } catch (err) {
    console.error('[api/detect]', err);
    return res.status(500).json({ error: err.message });
  }
}
