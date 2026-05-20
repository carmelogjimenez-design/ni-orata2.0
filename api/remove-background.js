export const config = { runtime: 'edge' };

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL = '851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Solo POST' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
  if (!REPLICATE_TOKEN) {
    return new Response(JSON.stringify({ error: 'REPLICATE_API_TOKEN no configurado en Vercel' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const input = body.imageUrl || body.imageBase64;
    if (!input) {
      return new Response(JSON.stringify({ error: 'Falta imageUrl o imageBase64' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        version: MODEL.split(':')[1],
        input: { image: input },
      }),
    });

    const prediction = await startRes.json();
    if (prediction.error) {
      return new Response(JSON.stringify({ error: prediction.error }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    let finalPrediction = prediction;
    let attempts = 0;
    while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(finalPrediction.urls.get, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
      });
      finalPrediction = await pollRes.json();
      attempts++;
    }

    if (finalPrediction.status === 'failed') {
      return new Response(JSON.stringify({ error: 'La IA falló: ' + finalPrediction.error }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    const url = Array.isArray(finalPrediction.output) ? finalPrediction.output[0] : finalPrediction.output;

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}
