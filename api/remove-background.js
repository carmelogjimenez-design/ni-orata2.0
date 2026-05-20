export const config = { runtime: 'edge' };

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL_VERSION = 'a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);
  if (!REPLICATE_TOKEN) return json({ error: 'REPLICATE_API_TOKEN no configurado' }, 500);

  try {
    const body = await req.json();
    const input = body.imageUrl || body.imageBase64;
    if (!input) return json({ error: 'Falta imageUrl o imageBase64' }, 400);

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: { image: input },
      }),
    });

    let prediction = await startRes.json();

    if (prediction.error) return json({ error: String(prediction.error) }, 500);
    if (!prediction.id || !prediction.urls || !prediction.urls.get) {
      return json({ error: 'Respuesta inesperada de Replicate: ' + JSON.stringify(prediction) }, 500);
    }

    const pollUrl = prediction.urls.get;
    let attempts = 0;
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < 60
    ) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(pollUrl, {
        headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
      });
      prediction = await pollRes.json();
      attempts++;
    }

    if (prediction.status !== 'succeeded') {
      return json({ error: 'Falló: ' + (prediction.error || prediction.status) }, 500);
    }

    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (!url) return json({ error: 'No se obtuvo URL de salida' }, 500);

    return json({ url });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
}
