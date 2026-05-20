export const config = { runtime: 'edge' };

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

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

const STYLE_TEMPLATES = {
  callejero: {
    prefix: 'gritty street football scene,',
    suffix: ', urban graffiti walls, golden hour light, shallow depth of field, 35mm film grain, cinematic composition, empty scene, no people',
  },
  cyberpunk: {
    prefix: 'neon-lit cyberpunk',
    suffix: ', rain-soaked streets, holographic billboards, purple and acid green lights, blade runner aesthetic, dense atmosphere, empty scene, no people',
  },
  poster: {
    prefix: 'dramatic cinematic poster background of',
    suffix: ', dark moody lighting, vignette, high contrast, cinematic color grading, depth, painterly textures, empty scene',
  },
  cromo: {
    prefix: 'vintage 90s trading card background,',
    suffix: ', metallic foil effect, holographic shine, geometric shapes, retro sports aesthetic, panini-style, empty card',
  },
  meme: {
    prefix: 'raw unfiltered photo of',
    suffix: ', amateur phone camera quality, harsh flash, awkward composition, internet meme aesthetic',
  },
  realista: {
    prefix: 'photorealistic',
    suffix: ', natural lighting, sharp focus, detailed textures, professional photography, empty scene, no people',
  },
};

function buildPrompt(userInput, style) {
  const t = STYLE_TEMPLATES[style] || STYLE_TEMPLATES.realista;
  return `${t.prefix} ${userInput.trim()}${t.suffix}`;
}

async function generateOne(prompt, aspectRatio) {
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        num_outputs: 1,
        num_inference_steps: 4,
        output_format: 'webp',
        output_quality: 85,
        go_fast: true,
        megapixels: '1',
      },
    }),
  });

  let prediction = await res.json();
  if (prediction.error) throw new Error(String(prediction.error));
  if (!prediction.id || !prediction.urls || !prediction.urls.get) {
    throw new Error('Respuesta inesperada: ' + JSON.stringify(prediction));
  }

  const pollUrl = prediction.urls.get;
  let attempts = 0;
  while (
    prediction.status !== 'succeeded' &&
    prediction.status !== 'failed' &&
    prediction.status !== 'canceled' &&
    attempts < 60
  ) {
    await new Promise((r) => setTimeout(r, 800));
    const pollRes = await fetch(pollUrl, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
    });
    prediction = await pollRes.json();
    attempts++;
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(prediction.error || prediction.status || 'failed');
  }

  return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Solo POST' }, 405);
  if (!REPLICATE_TOKEN) return json({ error: 'REPLICATE_API_TOKEN no configurado' }, 500);

  try {
    const body = await req.json();
    const userInput = body.userInput ?? '';
    const style = body.style ?? 'realista';
    const aspectRatio = body.aspectRatio ?? '4:5';
    const count = Math.min(Math.max(body.count ?? 4, 1), 4);

    if (!userInput.trim()) return json({ error: 'userInput vacío' }, 400);

    const prompt = buildPrompt(userInput, style);
    const promises = Array.from({ length: count }, () => generateOne(prompt, aspectRatio));
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
