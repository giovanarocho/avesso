// gate de acesso compartilhado por qualquer ferramenta da avesso.
//
// pra usar numa página nova: coloca isso logo antes do fechamento do
// <body>, com o slug do produto (o mesmo que está em lib/products.js):
//
//   <script src="/shared/gate.js" data-produto="molda"></script>
//
// não precisa de mais nada — o login, criar senha e redefinir senha
// inteiros ficam centralizados em /conta. essa página só confere se a
// pessoa está logada E se a conta dela tem esse produto; se não, manda
// pra /conta (que cuida do resto e traz ela de volta pra cá depois).
(function () {
  var scriptTag = document.currentScript;
  var produto = scriptTag.getAttribute('data-produto');
  var KEY = 'avesso_conta_token';

  var overlay = document.createElement('div');
  overlay.id = 'avesso-gate-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#3D2A1E;color:#F4ECDD;' +
    'display:flex;align-items:center;justify-content:center;padding:24px;' +
    'font-family:Georgia,serif;text-align:center;';
  overlay.innerHTML =
    '<div style="max-width:380px;width:100%;">' +
    '<p style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.65;margin:0 0 14px;">estúdio avesso</p>' +
    '<p id="avesso-gate-msg" style="font-size:15px;line-height:1.6;margin:0 0 20px;opacity:.9;">verificando seu acesso…</p>' +
    '<div id="avesso-gate-actions"></div>' +
    '</div>';
  document.documentElement.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  var msg = overlay.querySelector('#avesso-gate-msg');
  var actions = overlay.querySelector('#avesso-gate-actions');

  function returnUrl() {
    return window.location.pathname + window.location.search;
  }

  function goToConta() {
    window.location.href = '/conta?returnTo=' + encodeURIComponent(returnUrl()) + '&produto=' + encodeURIComponent(produto);
  }

  function unlock() {
    document.documentElement.style.overflow = '';
    overlay.remove();
  }

  function showBlocked(nome, vendaPath) {
    msg.textContent = 'sua conta ainda não tem acesso a ' + (nome || 'essa ferramenta') + '.';
    actions.innerHTML =
      '<a href="' + vendaPath + '" style="background:#E8CE9A;color:#3D2A1E;text-decoration:none;font-weight:600;' +
      'padding:14px 26px;border-radius:999px;display:inline-block;margin-bottom:14px;">saiba mais e comprar</a>' +
      '<p style="font-size:12.5px;margin:0;"><a id="avesso-gate-trocar" style="color:#E8CE9A;cursor:pointer;">entrar com outra conta</a></p>';
    overlay.querySelector('#avesso-gate-trocar').addEventListener('click', function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      goToConta();
    });
  }

  var token;
  try { token = localStorage.getItem(KEY); } catch (e) { token = null; }

  if (!token) {
    goToConta();
    return;
  }

  fetch('/api/account', { headers: { Authorization: 'Bearer ' + token } })
    .then(function (r) {
      if (r.status === 401) throw new Error('unauthorized');
      return r.json();
    })
    .then(function (data) {
      var item = (data.produtos || []).filter(function (p) { return p.slug === produto; })[0];
      if (item && item.owned) {
        unlock();
        return;
      }
      showBlocked(item ? item.nome : produto, item ? item.vendaPath : '/');
    })
    .catch(function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      goToConta();
    });
})();
