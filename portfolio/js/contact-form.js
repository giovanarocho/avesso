// Formulário "bora conversar" — envia direto pro e-mail da Gi, sem precisar
// de servidor próprio. Usa o FormSubmit (formsubmit.co), um serviço grátis
// que só encaminha o formulário pro e-mail configurado.
//
// IMPORTANTE (só na primeira vez): quando alguém enviar o primeiro contato
// pelo site, o FormSubmit manda um e-mail de confirmação pra
// suporte@rocholab.com pedindo pra clicar num link e ativar o
// recebimento. É só uma vez — depois disso, todo mundo que preencher o
// formulário cai direto na caixa de entrada.

const CONTACT_EMAIL = "suporte@rocholab.com";
const form = document.getElementById('contact-form');

if (form) {
  const statusEl = form.querySelector('[data-form-status]');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // honeypot: se um robô preencheu o campo escondido, finge que deu certo e não envia
    if (form._honey.value) {
      statusEl.textContent = 'Mensagem enviada — obrigada!';
      form.reset();
      return;
    }

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    statusEl.classList.remove('is-error');
    statusEl.textContent = '';

    const payload = {
      nome: form.nome.value,
      instagram: form.instagram.value,
      necessidade: form.necessidade.value,
      investimento: form.investimento.value,
      whatsapp: form.whatsapp.value,
      mensagem: form.message.value,
      _subject: `Novo contato pelo site — ${form.nome.value}`,
      _captcha: "false"
    };

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('falha no envio');

      statusEl.textContent = 'Mensagem enviada — a gente responde em breve. Obrigada!';
      form.reset();
    } catch (err) {
      statusEl.classList.add('is-error');
      statusEl.textContent = 'Não deu pra enviar agora. Tenta de novo ou chama no WhatsApp aqui embaixo.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
