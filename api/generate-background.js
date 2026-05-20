export const config = { runtime: 'edge' };

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
const FLUX_SCHNELL = 'black-forest-labs/flux-schnell';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
      'Prefer': 'wait',
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

  const prediction = await res.json();
  if (prediction.error) throw new Error(prediction.error);

  let finalPrediction = prediction;
  let attempts = 0;
  while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < 30) {
    await new Promise((r) => setTimeout(r, 800));
    const pollRes = await fetch(finalPrediction.urls.get, {
      headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` },
    });
    finalPrediction = await pollRes.json();
    attempts++;
  }

  if (finalPrediction.status === 'failed') throw new Error(finalPrediction.error || 'failed');
  return Array.isArray(finalPrediction.output) ? finalPrediction.output[0] : finalPrediction.output;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Solo POST' }), { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
  if (!REPLICATE_TOKEN) {
    return new Response(JSON.stringify({ error: 'REPLICATE_API_TOKEN no configurado' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const userInput = body.userInput ?? '';
    const style = body.style ?? 'realista';
    const aspectRatio = body.aspectRatio ?? '4:5';
    const count = Math.min(Math.max(body.count ?? 4, 1), 4);

    if (!userInput.trim()) {
      return new Response(JSON.stringify({ error: 'userInput vacío' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

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
      return new Response(JSON.stringify({ error: 'Todas las generaciones fallaron' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ options }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
}
