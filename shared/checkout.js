// checkout pix compartilhado por qualquer página de venda de ferramenta.
//
// pra usar numa página nova: mantém o mesmo html do modal (os ids abaixo
// já existem em guia-venda/index.html e molda/index.html — copia dali) e
// inclui, com o slug do produto (o mesmo de lib/products.js):
//
//   <script src="/shared/checkout.js" data-produto="molda"></script>
//
// ids esperados na página: #btn-abrir-checkout, #checkout-overlay,
// #cp-close, #cp-step-email, #cp-email, #cp-gerar-pix, #cp-email-msg,
// #cp-step-pix, #cp-qr-img, #cp-pix-code, #cp-copiar, #cp-status-msg,
// #cp-step-sucesso, #cp-sucesso-sub, #cp-link-conta.
(function () {
  var scriptTag = document.currentScript;
  var produto = scriptTag.getAttribute('data-produto');

  var overlay = document.getElementById('checkout-overlay');
  if (!overlay) return;

  var stepEmail = document.getElementById('cp-step-email');
  var stepPix = document.getElementById('cp-step-pix');
  var stepSucesso = document.getElementById('cp-step-sucesso');
  var pollTimer = null;

  function resetCheckout() {
    stepEmail.style.display = 'block';
    stepPix.style.display = 'none';
    stepSucesso.style.display = 'none';
    document.getElementById('cp-email-msg').textContent = '';
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function openCheckout() {
    resetCheckout();
    overlay.classList.add('open');
  }
  function closeCheckout() {
    overlay.classList.remove('open');
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  var abrirBtn = document.getElementById('btn-abrir-checkout');
  if (abrirBtn) abrirBtn.addEventListener('click', openCheckout);
  var closeBtn = document.getElementById('cp-close');
  if (closeBtn) closeBtn.addEventListener('click', closeCheckout);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeCheckout(); });

  document.getElementById('cp-gerar-pix').addEventListener('click', function () {
    var email = document.getElementById('cp-email').value.trim();
    var msgEl = document.getElementById('cp-email-msg');
    if (!email || email.indexOf('@') === -1) {
      msgEl.textContent = 'digite um e-mail válido.';
      return;
    }
    msgEl.textContent = 'gerando pix…';

    fetch('/api/payment?action=create&produto=' + encodeURIComponent(produto), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          msgEl.textContent = 'não consegui gerar o pix agora. tenta de novo em instantes.';
          return;
        }
        var data = res.data;
        if (data.qr_code_base64) {
          document.getElementById('cp-qr-img').src = 'data:image/png;base64,' + data.qr_code_base64;
        }
        document.getElementById('cp-pix-code').textContent = data.qr_code || '';

        stepEmail.style.display = 'none';
        stepPix.style.display = 'block';

        startPolling(data.payment_id);
      }).catch(function () {
        msgEl.textContent = 'não consegui conectar. verifica sua internet e tenta de novo.';
      });
  });

  var copiarBtn = document.getElementById('cp-copiar');
  if (copiarBtn) {
    copiarBtn.addEventListener('click', function () {
      var code = document.getElementById('cp-pix-code').textContent;
      if (!code) return;
      navigator.clipboard.writeText(code).then(function () {
        copiarBtn.textContent = 'copiado!';
        setTimeout(function () { copiarBtn.textContent = 'copiar código pix'; }, 2000);
      }).catch(function () {});
    });
  }

  function startPolling(paymentId) {
    var attempts = 0;
    var maxAttempts = 200;
    pollTimer = setInterval(function () {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(pollTimer);
        document.getElementById('cp-status-msg').textContent = 'tempo esgotado. se já pagou, feche e abra de novo, ou fale com a avesso.';
        return;
      }
      fetch('/api/payment?action=status&payment_id=' + encodeURIComponent(paymentId))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.approved) {
            clearInterval(pollTimer);
            pollTimer = null;
            stepPix.style.display = 'none';
            stepSucesso.style.display = 'block';
            var link = data.contaLink || '/conta';
            document.getElementById('cp-link-conta').setAttribute('href', link);
            var sub = document.getElementById('cp-sucesso-sub');
            if (sub) {
              sub.textContent = data.hasAccount
                ? 'já está liberado na sua conta — entra com o e-mail e a senha de sempre.'
                : 'falta só um passo: criar sua senha de acesso.';
            }
          } else if (data.status === 'rejected' || data.status === 'cancelled') {
            clearInterval(pollTimer);
            pollTimer = null;
            document.getElementById('cp-status-msg').textContent = 'esse pix não foi confirmado. feche e tente gerar um novo.';
          }
        }).catch(function () {});
    }, 3000);
  }
})();
