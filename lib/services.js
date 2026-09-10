// funções pequenas pra falar com o supabase (banco) e o resend (e-mail),
// direto pela api rest de cada um, via fetch — sem depender de nenhuma
// biblioteca extra. se as variáveis de ambiente não estiverem configuradas,
// cada função aqui simplesmente não faz nada (e avisa no log da vercel) —
// o checkout continua funcionando normalmente sem banco e sem e-mail.

import crypto from 'crypto';
import { PRODUCTS, getProduct } from './products.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'estúdio avesso <onboarding@resend.dev>';
const SITE_URL = (process.env.SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '')).replace(/\/$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;
const ADMIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// aceita o nome novo (CONTA_SESSION_SECRET) e, se não existir, o antigo
// (MOLDA_SESSION_SECRET) — quem já tinha configurado pro molda não precisa
// mexer em nada; a mesma chave agora vale pra conta inteira.
const SESSION_SECRET = process.env.CONTA_SESSION_SECRET || process.env.MOLDA_SESSION_SECRET || '';
const SESSION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias — é conta de cliente
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

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

// todos os pagamentos aprovados de um e-mail, pra saber quais ferramentas
// aquela conta já tem (usado pela página /conta e pelo login pós-compra).
export async function dbListComprasAprovadas(email) {
  if (!dbConfigured()) return [];
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/pagamentos?email=eq.' + encodeURIComponent(String(email || '').toLowerCase()) +
        '&status=eq.approved&select=produto',
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY } }
    );
    if (!r.ok) return [];
    const rows = await r.json();
    const slugs = new Set();
    (rows || []).forEach(function (row) { slugs.add(row.produto || 'guia'); });
    return Array.from(slugs);
  } catch (e) {
    console.log('supabase (list compras) falhou:', e.message);
    return [];
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
//
// guia e molda continuam com colunas fixas (guia_price/molda_price) por
// compatibilidade; qualquer ferramenta nova do catálogo (lib/products.js)
// cai automaticamente no campo genérico "precos" (jsonb) — dá pra definir
// o preço dela pelo painel sem nenhuma migração de banco.
export async function resolvePrices() {
  const row = await dbGetConfig();
  const precosJson = (row && row.precos) || {};

  const guiaPrice = parseFloat(row && row.guia_price != null ? row.guia_price : process.env.GUIA_PRICE || '39.90');
  const moldaPrice = parseFloat(row && row.molda_price != null ? row.molda_price : process.env.MOLDA_PRICE || '29.90');

  const precos = {};
  PRODUCTS.forEach(function (p) {
    if (p.slug === 'guia') { precos.guia = guiaPrice; return; }
    if (p.slug === 'molda') { precos.molda = moldaPrice; return; }
    const fromDb = precosJson[p.slug];
    precos[p.slug] = parseFloat(fromDb != null ? fromDb : (process.env[p.precoEnv] || p.precoPadrao));
  });

  return {
    guiaPrice: guiaPrice,
    moldaPrice: moldaPrice,
    basePrice: parseFloat(row && row.base_price != null ? row.base_price : process.env.BASE_PRICE || '6000'),
    manutencaoPrice: parseFloat(
      row && row.manutencao_price != null ? row.manutencao_price : process.env.MANUTENCAO_PRICE || '1500'
    ),
    manutencaoVagas:
      (row && row.manutencao_vagas) ||
      process.env.MANUTENCAO_VAGAS ||
      'restam poucas vagas por vez, pra dar atenção de verdade a cada cliente.',
    precos: precos,
    tutoriais: (row && row.tutoriais) || {}
  };
}

// links dos vídeos-tutorial de cada marco do guia (ex.: "escopo",
// "identidade-visual", "google", "whatsapp", "site", "redes",
// "manutencao", "trafego-pago") — guardados como um objeto único no campo
// genérico "tutoriais" (mesmo padrão de "precos"), editável pelo painel
// sem precisar de migração nova a cada marco que ganhar vídeo.
export async function dbSetTutoriais(links) {
  const row = await dbGetConfig();
  const tutoriais = Object.assign({}, (row && row.tutoriais) || {}, links);
  return dbSetConfig({ tutoriais: tutoriais, updated_at: new Date().toISOString() });
}

export async function resolveProductPrice(slug) {
  const prices = await resolvePrices();
  return prices.precos[slug];
}

// atualiza o preço de UM produto do catálogo. guia/molda usam as colunas
// fixas de sempre; qualquer outro produto é guardado no campo genérico
// "precos" (faz um merge, não sobrescreve os outros preços já salvos ali).
export async function dbSetPrecoProduto(slug, valor) {
  if (slug === 'guia') return dbSetConfig({ guia_price: valor, updated_at: new Date().toISOString() });
  if (slug === 'molda') return dbSetConfig({ molda_price: valor, updated_at: new Date().toISOString() });

  const row = await dbGetConfig();
  const precos = Object.assign({}, (row && row.precos) || {});
  precos[slug] = valor;
  return dbSetConfig({ precos: precos, updated_at: new Date().toISOString() });
}

// ---------- contas (e-mail + senha de verdade, serve qualquer ferramenta) ----------

export async function dbGetUsuario(email) {
  if (!dbConfigured()) return null;
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/usuarios?email=eq.' + encodeURIComponent(String(email || '').toLowerCase()) + '&select=*',
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.log('supabase (usuarios select) falhou:', e.message);
    return null;
  }
}

// insere um usuário novo. por padrão recusa se o e-mail já existir (quem já
// tem conta deve fazer login, não recriar a senha por aqui) — pra isso usa
// "resolution=ignore-duplicates" ao invés de merge.
export async function dbInsertUsuario(record) {
  if (!dbConfigured()) return false;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/usuarios', {
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
    console.log('supabase (usuarios insert) falhou:', e.message);
    return false;
  }
}

export async function dbUpdateSenha(email, passwordHash, passwordSalt) {
  if (!dbConfigured()) return false;
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/usuarios?email=eq.' + encodeURIComponent(String(email || '').toLowerCase()),
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
    console.log('supabase (usuarios update senha) falhou:', e.message);
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

// ---------- sessão da conta (mesmo princípio do token do painel: assinatura
// hmac com expiração, sem tabela de sessão nenhuma pra gerenciar) ----------

export function contaAuthConfigured() {
  return !!SESSION_SECRET;
}

function signPayload(obj, ttlMs) {
  const expires = Date.now() + ttlMs;
  const payload = JSON.stringify({ ...obj, exp: expires });
  const b64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('hex');
  return b64 + '.' + sig;
}

function verifyPayload(token) {
  if (!token || !SESSION_SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('hex');
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

export function issueContaToken(email) {
  return signPayload({ typ: 'sess', email: String(email || '').toLowerCase() }, SESSION_TOKEN_TTL_MS);
}

export function verifyContaToken(token) {
  const payload = verifyPayload(token);
  if (!payload || payload.typ !== 'sess' || !payload.email) return null;
  return payload.email;
}

export function issueResetToken(email) {
  return signPayload({ typ: 'reset', email: String(email || '').toLowerCase() }, RESET_TOKEN_TTL_MS);
}

export function verifyResetToken(token) {
  const payload = verifyPayload(token);
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

// ---------- e-mails ----------

function baseEmailHtml(eyebrow, titulo, corpoHtml) {
  return [
    '<div style="font-family:Georgia,serif;background:#F3EADA;padding:32px;color:#3D2A1E;">',
    '<p style="font-size:12px;letter-spacing:.05em;text-transform:uppercase;opacity:.65;margin:0 0 12px;">' + eyebrow + '</p>',
    '<h1 style="font-size:22px;font-weight:400;margin:0 0 16px;">' + titulo + '</h1>',
    corpoHtml,
    '</div>'
  ].join('');
}

async function sendEmail(to, subject, html) {
  if (!emailConfigured()) {
    console.log('RESEND_API_KEY não configurado — pulando envio de e-mail:', subject);
    return false;
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: to, subject: subject, html: html })
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

// mandado quando é a primeira compra de alguém (ainda não tem conta) —
// pede pra criar uma senha antes de liberar a ferramenta.
export async function sendBoasVindasEmail(email, setupLink, produtoNome) {
  const corpo = [
    '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">pagamento confirmado! falta só um passo: criar sua senha de acesso — essa mesma conta serve pra qualquer outra ferramenta que você comprar depois.</p>',
    '<p style="margin:0 0 20px;"><a href="' + setupLink + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;display:inline-block;">criar minha senha</a></p>',
    '<p style="font-size:12.5px;opacity:.7;margin:0;">se o botão não funcionar, copie este link: ' + setupLink + '</p>'
  ].join('');
  const html = baseEmailHtml('estúdio avesso · ' + produtoNome, 'seu acesso já está liberado', corpo);
  return sendEmail(email, 'seu acesso ao ' + produtoNome + ' — falta criar sua senha', html);
}

// mandado quando quem já tem conta (comprou outra ferramenta antes) compra
// mais uma — não precisa criar senha de novo, só entrar na conta de sempre.
export async function sendCompraConfirmadaEmail(email, produtoNome, contaLink) {
  const corpo = [
    '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">pagamento confirmado! o ' + produtoNome + ' já está liberado na sua conta — entra com o e-mail e a senha de sempre.</p>',
    '<p style="margin:0 0 20px;"><a href="' + contaLink + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;display:inline-block;">abrir minha conta</a></p>',
    '<p style="font-size:12.5px;opacity:.7;margin:0;">se o botão não funcionar, copie este link: ' + contaLink + '</p>'
  ].join('');
  const html = baseEmailHtml('estúdio avesso · ' + produtoNome, 'seu acesso já está liberado', corpo);
  return sendEmail(email, 'seu acesso ao ' + produtoNome + ' já está liberado', html);
}

export async function sendResetEmail(email, resetLink) {
  const corpo = [
    '<p style="font-size:15px;line-height:1.6;margin:0 0 20px;">pediram a redefinição da senha da sua conta avesso. se não foi você, pode ignorar esta mensagem.</p>',
    '<p style="margin:0 0 20px;"><a href="' + resetLink + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:999px;display:inline-block;">escolher nova senha</a></p>',
    '<p style="font-size:12.5px;opacity:.7;margin:0;">esse link vale por 30 minutos. se o botão não funcionar, copie este link: ' + resetLink + '</p>'
  ].join('');
  const html = baseEmailHtml('estúdio avesso', 'redefinir sua senha', corpo);
  return sendEmail(email, 'redefinir sua senha — estúdio avesso', html);
}

// ---------- confirmação de pagamento (compartilhado entre /api/payment e
// /api/webhook, pra não duplicar essa lógica em dois lugares) ----------
//
// confere o status no mercado pago, atualiza o banco, e manda o e-mail
// certo (boas-vindas com link de criar senha, ou aviso de compra pra quem
// já tem conta) — só uma vez por pagamento (por isso confere "code_sent").
export async function confirmarPagamento(paymentId) {
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) return { ok: false, error: 'MP_ACCESS_TOKEN não configurado no servidor' };

  const mpRes = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
    headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }
  });
  if (!mpRes.ok) return { ok: false, error: 'pagamento não encontrado' };
  const data = await mpRes.json();

  const approved = data.status === 'approved';
  const result = { ok: true, status: data.status, approved: approved, contaLink: null, hasAccount: null };
  if (!approved) return result;

  const row = await dbGetPagamento(paymentId);
  await dbPatchPagamento(paymentId, { status: 'approved' });

  const produtoSlug = (row && row.produto) || 'guia';
  const produto = getProduct(produtoSlug);
  const produtoNome = produto ? produto.nome : produtoSlug;
  const email = row && row.email ? String(row.email).toLowerCase() : null;

  if (email) {
    const usuario = await dbGetUsuario(email);
    const hasAccount = !!usuario;
    result.hasAccount = hasAccount;

    if (hasAccount) {
      result.contaLink = (SITE_URL || '') + '/conta?login=1&email=' + encodeURIComponent(email);
    } else {
      result.contaLink = (SITE_URL || '') + '/conta?setup=1&payment_id=' + encodeURIComponent(String(paymentId)) +
        '&email=' + encodeURIComponent(email);
    }

    if (row && !row.code_sent) {
      const sent = hasAccount
        ? await sendCompraConfirmadaEmail(email, produtoNome, result.contaLink)
        : await sendBoasVindasEmail(email, result.contaLink, produtoNome);
      if (sent) await dbPatchPagamento(paymentId, { code_sent: true });
    }
  }

  return result;
}
