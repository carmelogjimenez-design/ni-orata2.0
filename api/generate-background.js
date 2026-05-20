export const config = { runtime: 'edge' };

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const MODEL = 'black-forest-labs/FLUX.1-schnell';

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

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

const STYLE_TEMPLATES = {
  callejero: {
    prefix: 'gritty street football scene,',
    suffix: ', urban graffiti walls, golden hour light, cinematic, empty scene, no people',
  },
  cyberpunk: {
    prefix: 'neon-lit cyberpunk',
    suffix: ', rain-soaked streets, holographic billboards, purple and green lights, empty scene, no people',
  },
  poster: {
    prefix: 'dramatic cinematic poster background of',
    suffix: ', dark moody lighting, high contrast, cinematic color grading, empty scene',
  },
  cromo: {
    prefix: 'vintage 90s trading card background,',
    suffix: ', metallic foil effect, holographic shine, geometric shapes, panini-style',
  },
  meme: {
    prefix: 'raw unfiltered photo of',
    suffix: ', amateur phone camera, harsh flash, internet meme aesthetic',
  },
  realista: {
    prefix: 'photorealistic',
    suffix: ', natural lighting, sharp focus, professional photography, empty scene, no people',
  },
};

function buildPrompt(userInput, style) {
  const t = STYLE_TEMPLATES[style] || STYLE_TEMPLATES.realista;
  return `${t.prefix} ${userInput.trim()}${t.suffix}`;
}

async function generateOne(prompt, seed) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
        'x-use-cache': 'false',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: 768,
          height: 960,
          num_inference_steps: 4,
          seed,
        },
      }),
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const b64 = bufferToBase64(buffer);
      return `data:image/png;base64,${b64}`;
    }

    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 8000));
      continue;
    }

    const errText = await res.text();
    throw new Error(`HF ${res.status}: ${errText.slice(0, 150)}`);
  }
  throw new Error('Modelo cargando, reintenta en 30s');
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);
  if (!HF_TOKEN) return json({ error: 'HUGGINGFACE_API_TOKEN no configurado en Vercel' }, 500);

  try {
    const body = await req.json();
    const userInput = body.userInput ?? '';
    const style = body.style ?? 'realista';
    const count = Math.min(Math.max(body.count ?? 4, 1), 4);

    if (!userInput.trim()) return json({ error: 'userInput vacío' }, 400);

    const prompt = buildPrompt(userInput, style);

    const promises = Array.from({ length: count }, (_, i) =>
      generateOne(prompt, Math.floor(Math.random() * 1000000) + i)
    );
    const results = await Promise.allSettled(promises);

    const options = results
      .filter((r) => r.status === 'fulfilled')
      .map((r, i) => ({
        id: `bg_${Date.now()}_${i}`,
        url: r.value,
        prompt,
        style,
      }));

    if (options.length === 0) {
      const firstError = results.find((r) => r.status === 'rejected');
      return json({ error: 'Todas fallaron: ' + (firstError?.reason?.message || 'desconocido') }, 500);
    }

    return json({ options });
  } catch (err) {
    return json({ error: err.message || String(err) }, 500);
  }
}
