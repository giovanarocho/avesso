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

const MOLDA_SESSION_SECRET = process.env.MOLDA_SESSION_SECRET || '';
const MOLDA_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias — é conta de cliente, sessão mais longa que a do painel
const MOLDA_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutos

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
      'restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.',
    moldaPrice: parseFloat(row && row.molda_price != null ? row.molda_price : process.env.MOLDA_PRICE || '29.90')
  };
}

// ---------- contas do molda (e-mail + senha de verdade) ----------

export async function dbGetMoldaUsuario(email) {
  if (!dbConfigured()) return null;
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/molda_usuarios?email=eq.' + encodeURIComponent(String(email || '').toLowerCase()) + '&select=*',
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log('supabase (molda_usuarios select) falhou:', e.message);
    return null;
  }
}

// insere um usuário novo do molda. por padrão recusa se o e-mail já existir
// (quem já tem conta deve fazer login, não recriar a senha por aqui) — pra
// isso usa "resolution=ignore-duplicates" ao invés de merge.
export async function dbInsertMoldaUsuario(record) {
  if (!dbConfigured()) return false;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/molda_usuarios', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation'
      },
      body: JSON.stringify({ ...record, email: String(record.email || '').toLowerCase() })
    });
    if (!r.ok) return false;
    const rows = await r.json();
    // se o e-mail já existia, o postgrest responde 201 mas devolve lista vazia
    // (nada foi inserido de novo) — é assim que a gente detecta duplicidade.
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    console.log('supabase (molda_usuarios insert) falhou:', e.message);
    return false;
  }
}

export async function dbUpdateMoldaSenha(email, passwordHash, passwordSalt) {
  if (!dbConfigured()) return false;
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/molda_usuarios?email=eq.' + encodeURIComponent(String(email || '').toLowerCase()),
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ password_hash: passwordHash, password_salt: passwordSalt })
      }
    );
    return r.ok;
  } catch (e) {
    console.log('supabase (molda_usuarios update senha) falhou:', e.message);
    return false;
  }
}

// ---------- senha (hash + salt via crypto.scrypt, sem dependência nova) ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    const check = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(check);
    const b = Buffer.from(hash);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

// ---------- sessão do molda (mesmo princípio do token do painel: assinatura
// hmac com expiração, sem tabela de sessão nenhuma pra gerenciar) ----------

export function moldaAuthConfigured() {
  return !!MOLDA_SESSION_SECRET;
}

function signMoldaPayload(obj, ttlMs) {
  const expires = Date.now() + ttlMs;
  const payload = JSON.stringify({ ...obj, exp: expires });
  const b64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', MOLDA_SESSION_SECRET).update(b64).digest('hex');
  return b64 + '.' + sig;
}

function verifyMoldaPayload(token) {
  if (!token || !MOLDA_SESSION_SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = crypto.createHmac('sha256', MOLDA_SESSION_SECRET).update(b64).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export function issueMoldaToken(email) {
  return signMoldaPayload({ typ: 'sess', email: String(email || '').toLowerCase() }, MOLDA_TOKEN_TTL_MS);
}

export function verifyMoldaToken(token) {
  const payload = verifyMoldaPayload(token);
  if (!payload || payload.typ !== 'sess' || !payload.email) return null;
  return payload.email;
}

export function issueMoldaResetToken(email) {
  return signMoldaPayload({ typ: 'reset', email: String(email || '').toLowerCase() }, MOLDA_RESET_TTL_MS);
}

export function verifyMoldaResetToken(token) {
  const payload = verifyMoldaPayload(token);
  if (!payload || payload.typ !== 'reset' || !payload.email) return null;
  return payload.email;
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

export async function sendMoldaBoasVindasEmail(email, setupLink) {
  if (!emailConfigured()) {
    console.log('RESEND_API_KEY não configurado — pulando envio de e-mail de boas-vindas do molda');
    return false;
  }
  const html = [
    '<div style="font-family:Georgia,serif;background:#F3EADA;padding:32px;color:#3D2A1E;">',
    '<p style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.65;margin:0 0 12px;">estúdio avesso · molda</p>',
    '<h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">seu molda já está liberado</h1>',
    '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">pagamento confirmado! falta só um passo: criar sua senha de acesso.</p>',
    '<p style="margin:0 0 20px;"><a href="' + setupLink + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;display:inline-block;">criar minha senha</a></p>',
    '<p style="font-size:12.5px;opacity:.7;margin:0;">se o botão não funcionar, copie este link: ' + setupLink + '</p>',
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
        subject: 'seu acesso ao molda — falta criar sua senha',
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

export async function sendMoldaResetEmail(email, resetLink) {
  if (!emailConfigured()) {
    console.log('RESEND_API_KEY não configurado — pulando envio de e-mail de redefinição do molda');
    return false;
  }
  const html = [
    '<div style="font-family:Georgia,serif;background:#F3EADA;padding:32px;color:#3D2A1E;">',
    '<p style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.65;margin:0 0 12px;">estúdio avesso · molda</p>',
    '<h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">redefinir sua senha</h1>',
    '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">pediram a redefinição da senha do molda pra este e-mail. se não foi você, pode ignorar esta mensagem.</p>',
    '<p style="margin:0 0 20px;"><a href="' + resetLink + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;display:inline-block;">escolher nova senha</a></p>',
    '<p style="font-size:12.5px;opacity:.7;margin:0;">esse link vale por 30 minutos. se o botão não funcionar, copie este link: ' + resetLink + '</p>',
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
        subject: 'redefinir sua senha do molda',
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
