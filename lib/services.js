// funções pequenas pra falar com o supabase (banco) e o resend (e-mail),
// direto pela api rest de cada um, via fetch — sem depender de nenhuma
// biblioteca extra. se as variáveis de ambiente não estiverem configuradas,
// cada função aqui simplesmente não faz nada (e avisa no log da vercel) —
// o checkout continua funcionando normalmente sem banco e sem e-mail,
// porque o código de acesso na tela já é o essencial.

import crypto from 'crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'estúdio avesso <onboarding@resend.dev>';
const SITE_URL = (process.env.SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')).replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;
const ADMIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export function dbConfigured() {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

export function emailConfigured() {
  return !!RESEND_API_KEY;
}

// grava (ou atualiza, se já existir) a linha do pagamento assim que o pix é criado.
export async function dbUpsertPagamento(record) {
  if (!dbConfigured()) return;
  try {
    await fetch(SUPABASE_URL + '/rest/v1/pagamentos', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(record)
    });
  } catch (e) {
    console.log('supabase (upsert) falhou, seguindo sem banco:', e.message);
  }
}

export async function dbGetPagamento(paymentId) {
  if (!dbConfigured()) return null;
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/pagamentos?payment_id=eq.' + encodeURIComponent(paymentId) + '&select=*',
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log('supabase (select) falhou:', e.message);
    return null;
  }
}

// extraFilter (opcional) é um pedaço a mais de query string do postgrest,
// ex: '&guia_acessado_em=is.null' — pra só atualizar se ainda não tiver valor.
export async function dbPatchPagamento(paymentId, fields, extraFilter) {
  if (!dbConfigured()) return;
  try {
    await fetch(
      SUPABASE_URL + '/rest/v1/pagamentos?payment_id=eq.' + encodeURIComponent(paymentId) + (extraFilter || ''),
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(fields)
      }
    );
  } catch (e) {
    console.log('supabase (update) falhou:', e.message);
  }
}

// ---------- config editável (preços) ----------

export async function dbGetConfig() {
  if (!dbConfigured()) return null;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/config?id=eq.1&select=*', {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY }
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log('supabase (config get) falhou:', e.message);
    return null;
  }
}

export async function dbSetConfig(fields) {
  if (!dbConfigured()) return false;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/config?id=eq.1', {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(fields)
    });
    return r.ok;
  } catch (e) {
    console.log('supabase (config set) falhou:', e.message);
    return false;
  }
}

// preços mostrados no site e cobrados de verdade: primeiro tenta o banco
// (editável pelo painel /painel), e só usa a variável de ambiente como
// reserva — pra continuar funcionando mesmo sem o supabase configurado.
export async function resolvePrices() {
  const row = await dbGetConfig();
  return {
    guiaPrice: parseFloat(row && row.guia_price != null ? row.guia_price : process.env.GUIA_PRICE || '39.90'),
    basePrice: parseFloat(row && row.base_price != null ? row.base_price : process.env.BASE_PRICE || '6000'),
    manutencaoPrice: parseFloat(
      row && row.manutencao_price != null ? row.manutencao_price : process.env.MANUTENCAO_PRICE || '1500'
    ),
    manutencaoVagas:
      (row && row.manutencao_vagas) ||
      process.env.MANUTENCAO_VAGAS ||
      'restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.'
  };
}

// ---------- lista de vendas (pro painel) ----------

export async function dbListPagamentos(limit) {
  if (!dbConfigured()) return [];
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/pagamentos?select=*&order=created_at.desc&limit=' + (limit || 300),
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY } }
    );
    if (!r.ok) return [];
    return await r.json();
  } catch (e) {
    console.log('supabase (list pagamentos) falhou:', e.message);
    return [];
  }
}

// ---------- login do painel (sem tabela de sessão nenhuma) ----------
// o "token" é só um carimbo de validade + uma assinatura hmac dele mesmo,
// usando ADMIN_SECRET como chave. dá pra conferir se é válido sem guardar
// nada em lugar nenhum — se a assinatura bate e não expirou, é válido.

export function adminConfigured() {
  return !!ADMIN_PASSWORD;
}

export function checkAdminPassword(password) {
  if (!ADMIN_PASSWORD) return false;
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function issueAdminToken() {
  const expires = Date.now() + ADMIN_TOKEN_TTL_MS;
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(String(expires)).digest('hex');
  return expires + '.' + sig;
}

export function verifyAdminToken(token) {
  if (!token || !ADMIN_SECRET) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const expires = parseInt(parts[0], 10);
  if (!expires || Date.now() > expires) return false;
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(String(expires)).digest('hex');
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function sendCodeEmail(email, paymentId) {
  if (!emailConfigured()) {
    console.log('RESEND_API_KEY não configurado — pulando envio de e-mail do código');
    return false;
  }
  const guiaLink = (SITE_URL || '') + '/guia?code=' + encodeURIComponent(paymentId);
  const html = [
    '<div style="font-family:Georgia,serif;background:#F3EADA;padding:32px;color:#3D2A1E;">',
    '<p style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.65;margin:0 0 12px;">estúdio avesso</p>',
    '<h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">seu guia já está liberado</h1>',
    '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">pagamento confirmado! aqui está seu código de acesso — guarde ele, é com ele que você entra no guia sempre que quiser, em qualquer aparelho.</p>',
    '<p style="font-family:monospace;font-size:16px;background:#fff;border:1px solid rgba(61,42,30,.2);border-radius:10px;padding:14px 16px;display:inline-block;margin:0 0 20px;">' + paymentId + '</p>',
    '<p style="margin:0 0 20px;"><a href="' + guiaLink + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;display:inline-block;">abrir o guia agora</a></p>',
    '<p style="font-size:12.5px;opacity:.7;margin:0;">se o botão não funcionar, copie este link: ' + guiaLink + '</p>',
    '</div>'
  ].join('');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: email,
        subject: 'seu código de acesso ao guia marketing essencial',
        html: html
      })
    });
    if (!r.ok) {
      console.log('resend falhou:', r.status, await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.log('erro ao chamar resend:', e.message);
    return false;
  }
}
