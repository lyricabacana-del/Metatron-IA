export const maxDuration = 300;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nvidia-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });

  try {
    const { mensaje, historial, formato, model, max_tokens, enable_thinking } = req.body;

    const apiKey = req.headers['x-nvidia-key'] || req.body.api_key;

    if (!apiKey || !apiKey.startsWith('nvapi-')) {
      return res.status(401).json({ error: 'Falta API key de NVIDIA valida' });
    }

    if (!mensaje) {
      return res.status(400).json({ error: 'Falta el mensaje' });
    }

    const selectedModel = model || 'nvidia/nemotron-3.5-lightning-30b-a3b';
    const maxTokens = Math.min(parseInt(max_tokens) || 8192, 65536);

    const systemPrompt = 'Eres METATRON IA. Motor Nemotron.\nReglas:\n1. Texto puro, formato multiple segun lo necesario: tabla, lista, codigo, doc, paso a paso.\n2. Ultraligero: respuestas cortas, densas, sin relleno.\n3. El usuario en dispositivo de gama baja solo lee. Todo el peso en la nube.\n4. Formato solicitado: ' + (formato || 'auto') + '\n5. Directo, util, preciso.';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(historial || []),
      { role: 'user', content: mensaje }
    ];

    const payload = {
      model: selectedModel,
      messages: messages,
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: maxTokens,
      stream: true
    };

    if (enable_thinking) {
      payload.extra_body = { chat_template_kwargs: { enable_thinking: true } };
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = 'Error ' + response.status;
      try {
        const errObj = JSON.parse(errorText);
        errorMsg = errObj.error?.message || errObj.message || errorMsg;
      } catch (e) {
        errorMsg = errorText.slice(0, 200);
      }
      return res.status(response.status).json({ error: errorMsg });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const chunk = line.slice(6);
        if (chunk.trim() === '[DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }
        try {
          const obj = JSON.parse(chunk);
          const delta = obj.choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            res.write('data: ' + JSON.stringify({ reasoning: delta.reasoning_content }) + '\n\n');
          }
          if (delta?.content) {
            res.write('data: ' + JSON.stringify({ delta: delta.content }) + '\n\n');
          }
        } catch (e) {}
      }
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
}
