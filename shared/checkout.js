// checkout (pix + cartão) compartilhado por qualquer página de venda de
// ferramenta.
//
// pra usar numa página nova: mantém o mesmo html do modal (os ids abaixo
// já existem em guia-venda/index.html e molda/index.html — copia dali) e
// inclui, com o slug do produto (o mesmo de lib/products.js):
//
//   <script src="/shared/checkout.js" data-produto="molda"></script>
//
// ids esperados na página: #btn-abrir-checkout, #checkout-overlay,
// #cp-close, #cp-step-email, #cp-email, #cp-method-pix, #cp-method-cartao,
// #cp-gerar-pix, #cp-card-brick, #cp-email-msg, #cp-step-pix, #cp-qr-box,
// #cp-qr-img, #cp-pix-code, #cp-copiar, #cp-status-msg, #cp-step-sucesso,
// #cp-sucesso-sub, #cp-link-conta.
//
// cartão: o número do cartão NUNCA passa pelo nosso servidor. o Payment
// Brick do Mercado Pago roda dentro de um iframe deles, tokeniza o cartão
// direto no navegador de quem compra, e só o token (não o número) chega
// no nosso /api/payment. é o mesmo princípio de segurança de qualquer
// checkout grande — a gente nunca vê nem guarda dado de cartão.
(function () {
  var scriptTag = document.currentScript;
  var produto = scriptTag.getAttribute('data-produto');

  var overlay = document.getElementById('checkout-overlay');
  if (!overlay) return;

  var stepEmail = document.getElementById('cp-step-email');
  var stepPix = document.getElementById('cp-step-pix');
  var stepSucesso = document.getElementById('cp-step-sucesso');
  var qrBox = document.getElementById('cp-qr-box');
  var cardBrickEl = document.getElementById('cp-card-brick');
  var btnPix = document.getElementById('cp-gerar-pix');
  var tabPix = document.getElementById('cp-method-pix');
  var tabCartao = document.getElementById('cp-method-cartao');
  var pollTimer = null;
  var metodo = 'pix';
  var brickInstance = null;
  var mpConfigPromise = null;

  function resetCheckout() {
    stepEmail.style.display = 'block';
    stepPix.style.display = 'none';
    stepSucesso.style.display = 'none';
    document.getElementById('cp-email-msg').textContent = '';
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    setMetodo('pix');
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

  function getEmail() {
    return document.getElementById('cp-email').value.trim();
  }
  function validaEmail(msgEl) {
    var email = getEmail();
    if (!email || email.indexOf('@') === -1) {
      if (msgEl) msgEl.textContent = 'digite um e-mail válido.';
      return null;
    }
    return email;
  }

  function setMetodo(novo) {
    metodo = novo;
    if (tabPix) tabPix.classList.toggle('active', metodo === 'pix');
    if (tabCartao) tabCartao.classList.toggle('active', metodo === 'cartao');
    if (btnPix) btnPix.style.display = metodo === 'pix' ? 'block' : 'none';
    if (cardBrickEl) cardBrickEl.style.display = metodo === 'cartao' ? 'block' : 'none';
  }

  if (tabPix) tabPix.addEventListener('click', function () { setMetodo('pix'); });
  if (tabCartao) {
    tabCartao.addEventListener('click', function () {
      var msgEl = document.getElementById('cp-email-msg');
      var email = validaEmail(msgEl);
      if (!email) return;
      msgEl.textContent = '';
      setMetodo('cartao');
      loadCardBrick(email);
    });
  }

  // ---------- pix ----------
  if (btnPix) {
    btnPix.addEventListener('click', function () {
      var msgEl = document.getElementById('cp-email-msg');
      var email = validaEmail(msgEl);
      if (!email) return;
      msgEl.textContent = 'gerando pix…';

      fetch('/api/payment?action=create&produto=' + encodeURIComponent(produto), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, method: 'pix' })
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

          irParaAguardando('pix');
          startPolling(data.payment_id);
        }).catch(function () {
          msgEl.textContent = 'não consegui conectar. verifica sua internet e tenta de novo.';
        });
    });
  }

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

  // ---------- cartão (Payment Brick do Mercado Pago) ----------
  function getMpConfig() {
    if (!mpConfigPromise) {
      mpConfigPromise = fetch('/api/config').then(function (r) { return r.json(); });
    }
    return mpConfigPromise;
  }

  function loadSdk() {
    if (window.MercadoPago) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://sdk.mercadopago.com/js/v2';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadCardBrick(email) {
    if (brickInstance) return; // já montado nesta abertura do modal
    cardBrickEl.innerHTML = '<p class="cp-msg">carregando pagamento por cartão…</p>';

    Promise.all([getMpConfig(), loadSdk()]).then(function (results) {
      var cfg = results[0];
      if (!cfg.mpPublicKey) {
        cardBrickEl.innerHTML = '<p class="cp-msg">pagamento por cartão indisponível no momento. tenta pelo pix.</p>';
        return;
      }
      var amount = cfg.precos && cfg.precos[produto];
      cardBrickEl.innerHTML = '';
      var mp = new window.MercadoPago(cfg.mpPublicKey, { locale: 'pt-BR' });
      var bricksBuilder = mp.bricks();
      brickInstance = bricksBuilder.create('payment', 'cp-card-brick', {
        initialization: {
          amount: amount,
          payer: { email: email }
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            ticket: 'excluded',
            bankTransfer: 'excluded',
            maxInstallments: 12
          }
        },
        callbacks: {
          onSubmit: function (params) {
            var formData = params.formData || {};
            return new Promise(function (resolve, reject) {
              var msgEl = document.getElementById('cp-email-msg');
              fetch('/api/payment?action=create&produto=' + encodeURIComponent(produto), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ method: 'cartao' }, formData))
              }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
                .then(function (res) {
                  if (!res.ok) {
                    if (msgEl) msgEl.textContent = 'não consegui processar esse cartão. confere os dados ou tenta outro.';
                    reject();
                    return;
                  }
                  resolve();
                  if (res.data.status === 'rejected') {
                    if (msgEl) msgEl.textContent = 'o cartão foi recusado. tenta outro cartão ou paga pelo pix.';
                    return;
                  }
                  irParaAguardando('cartao');
                  startPolling(res.data.payment_id);
                }).catch(function () {
                  if (msgEl) msgEl.textContent = 'não consegui conectar. verifica sua internet e tenta de novo.';
                  reject();
                });
            });
          },
          onError: function () {
            var msgEl = document.getElementById('cp-email-msg');
            if (msgEl) msgEl.textContent = 'não consegui carregar o pagamento por cartão. tenta pelo pix.';
          }
        }
      });
    }).catch(function () {
      cardBrickEl.innerHTML = '<p class="cp-msg">não consegui carregar o pagamento por cartão. tenta pelo pix.</p>';
    });
  }

  // ---------- aguardando confirmação (comum aos dois métodos) ----------
  function irParaAguardando(metodoUsado) {
    stepEmail.style.display = 'none';
    stepPix.style.display = 'block';
    if (qrBox) qrBox.style.display = metodoUsado === 'pix' ? 'block' : 'none';
    document.getElementById('cp-status-msg').textContent = metodoUsado === 'pix'
      ? 'aguardando confirmação do pagamento…'
      : 'confirmando o pagamento do cartão…';
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
            document.getElementById('cp-status-msg').textContent = 'esse pagamento não foi confirmado. feche e tente de novo.';
          }
        }).catch(function () {});
    }, 3000);
  }
})();
