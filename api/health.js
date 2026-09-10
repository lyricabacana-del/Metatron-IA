export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json({
    server: 'Metatron IA',
    status: 'ok',
    mode: 'dark',
    theme: 'black-os',
    model_default: 'nvidia/nemotron-3-ultra-550b-a55b',
    models: [
      'nvidia/nemotron-3-ultra-550b-a55b',
      'nvidia/nemotron-3.5-lightning-30b-a3b',
      'nvidia/nemotron-3-super-120b-a12b',
      'nvidia/llama-3.3-70b-instruct'
    ],
    limits: {
      max_context_tokens: 1000000,
      max_output_tokens: 65536,
      rpm_limit: 40
    },
    timestamp: new Date().toISOString()
  });
}
