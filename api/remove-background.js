export const config = { runtime: 'edge' };

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const MODEL = 'briaai/RMBG-1.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function base64ToBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);
  if (!HF_TOKEN) return json({ error: 'HUGGINGFACE_API_TOKEN no configurado en Vercel' }, 500);

  try {
    const body = await req.json();
    const input = body.imageBase64;
    if (!input) return json({ error: 'Falta imageBase64' }, 400);

    const base64 = input.includes(',') ? input.split(',')[1] : input;
    const imageBytes = base64ToBuffer(base64);

    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      const hfRes = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imageBytes,
      });

      if (hfRes.ok) {
        const resultBuffer = await hfRes.arrayBuffer();
        const resultBase64 = bufferToBase64(resultBuffer);
        const dataUrl = `data:image/png;base64,${resultBase64}`;
        return json({ url: dataUrl });
      }

      const errText = await hfRes.text();
      lastError = errText;

      if (hfRes.status === 503) {
        await new Promise((r) => setTimeout(r, 8000));
        continue;
      }

      return json({ error: `HF error ${hfRes.status}: ${errText.slice(0, 200)}` }, 500);
    }

    return json({ error: 'Modelo cargando, reintenta en 30s: ' + lastError.slice(0, 150) }, 503);
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
}
