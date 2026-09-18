import { resolvePrices, getProductBySlug } from '../lib/services.js';

const MAX_TOTAL_LENGTH = 20000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ação extra encaixada aqui (em vez de uma função nova) pra não estourar
  // o limite de 12 funções serverless do plano hobby da vercel: devolve o
  // conteúdo completo de uma ferramenta do catálogo, usado pela página de
  // venda genérica (/loja?p=slug) — assim uma ferramenta nova, criada só
  // pelo painel, já nasce com uma página pra divulgar, sem precisar de
  // nenhum html novo por ferramenta.
  if (req.method === 'GET' && req.query.produto) {
    const produto = await getProductBySlug(String(req.query.produto));
    if (!produto || produto.ativo === false) {
      res.status(404).json({ error: 'ferramenta não encontrada' });
      return;
    }
    res.status(200).json({ produto: produto });
    return;
  }

  // ação extra encaixada aqui pra não estourar o limite de 12 funções
  // serverless do plano hobby da vercel (mesma solução do molda-auth.js).
  // conduz a conversa do diagnóstico de posicionamento (página /diagnostico).
  // recebe { action: "diagnostico", system, messages, max_tokens } — uma
  // conversa de verdade (histórico crescente), não um prompt único, porque
  // a entrevista é adaptativa: cada pergunta depende do que já foi dito.
  if (req.method === 'POST' && req.body && req.body.action === 'diagnostico') {
    const API_KEY = process.env.ANTHROPIC_API_KEY;
    if (!API_KEY) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });
      return;
    }

    const system = (req.body.system || '').toString();
    const messages = Array.isArray(req.body.messages) ? req.body.messages : null;
    const maxTokens = Math.min(Number(req.body.max_tokens) || 400, 1500);

    if (!messages || !messages.length) {
      res.status(400).json({ error: 'conversa inválida' });
      return;
    }

    const totalLength = system.length + messages.reduce(function (sum, m) {
      return sum + String(m.content || '').length;
    }, 0);
    if (totalLength > MAX_TOTAL_LENGTH) {
      res.status(400).json({ error: 'conversa muito longa' });
      return;
    }
    // sanitiza: só role/content, só user/assistant, nada além disso passa pra api.
    const cleanMessages = messages
      .filter(function (m) { return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'; })
      .map(function (m) { return { role: m.role, content: m.content.slice(0, 4000) }; });

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
          max_tokens: maxTokens,
          system: system || undefined,
          messages: cleanMessages
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
      console.error('erro interno na ação diagnostico (via /api/config):', err);
      res.status(500).json({ error: 'erro interno' });
    }
    return;
  }

  // comportamento original: devolve os preços públicos.
  const prices = await resolvePrices();
  // a public key do Mercado Pago é feita pra ficar no navegador (diferente
  // do MP_ACCESS_TOKEN, que é secreto e só usado no servidor) — é o que o
  // Payment Brick usa no checkout com cartão.
  prices.mpPublicKey = process.env.MP_PUBLIC_KEY || null;
  res.status(200).json(prices);
}
