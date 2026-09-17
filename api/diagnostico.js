// endpoint do "diagnóstico de posicionamento" — recebe um prompt já pronto
// (montado no front-end, em js/diagnostico.js) e repassa pra api da
// anthropic (claude), guardando a chave no servidor. sem essa variável de
// ambiente configurada, o diagnóstico simplesmente não funciona (a página
// mostra erro de forma amigável).

const MAX_PROMPT_LENGTH = 8000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'método não permitido' });
    return;
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });
    return;
  }

  const prompt = (req.body && req.body.prompt || '').toString();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: 'prompt inválido ou muito longo' });
    return;
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('erro da api anthropic:', errText);
      res.status(502).json({ error: 'falha ao gerar a leitura agora' });
      return;
    }

    const data = await anthropicRes.json();
    const text = (data.content || [])
      .filter(function (block) { return block.type === 'text'; })
      .map(function (block) { return block.text; })
      .join('\n')
      .trim();

    if (!text) {
      res.status(502).json({ error: 'resposta vazia' });
      return;
    }

    res.status(200).json({ text: text });
  } catch (err) {
    console.error('erro interno no /api/diagnostico:', err);
    res.status(500).json({ error: 'erro interno' });
  }
}
