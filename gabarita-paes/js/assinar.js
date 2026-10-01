(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let charge = null;
  let busy = false;
  let timer = null;
  let checks = 0;
  let failures = 0;
  let lastCheck = 0;
  const interval = 15000;
  const maxChecks = 12;
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!charge || charge.status !== 'PENDING' || document.hidden || failures >= 3) return;
    if (checks >= maxChecks) {
      if (!failures) message('O acompanhamento automático terminou. Se já pagou, clique em “Verificar pagamento”. Não é necessário gerar outro Pix.');
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (!document.hidden && charge?.status === 'PENDING') {
        checks++;
        refresh();
      }
    }, interval);
  }
  function refresh() {
    if (!charge || busy) return;
    const remaining = interval - (Date.now() - lastCheck);
    if (remaining > 0) {
      message('Aguarde alguns segundos para consultar novamente.');
      return;
    }
    lastCheck = Date.now();
    return run(() => window.api.get(`/payments/charges/${encodeURIComponent(charge.chargeId)}`));
  }
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  let checkoutKey = window.crypto.randomUUID();
  function message(text, error = false) {
    $('pix-message').textContent = text;
    $('pix-message').classList.toggle('is-error', error);
  }
  function date(value) {
    return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  }
  function render(value) {
    if (charge?.chargeId !== value.chargeId) {
      checks = 0;
      failures = 0;
    }
    charge = value;
    $('pix-result').hidden = false;
    const pending = value.status === 'PENDING';
    const test = value.environment === 'test';
    $('pix-test').hidden = !test;
    $('pix-qr').hidden = !pending || !value.pixQrCode;
    if (pending && value.pixQrCode && /^[A-Za-z0-9+/=]+$/.test(value.pixQrCode))
      $('pix-qr').src = `data:image/png;base64,${value.pixQrCode}`;
    $('pix-code').value = value.pixCode || '';
    $('pix-code-wrap').hidden = !pending || !value.pixCode;
    $('pix-refresh').hidden = !pending;
    $('pix-expiration').textContent = pending ? `Prazo do Pix: ${date(value.pixExpiresAt)}.` : '';
    $('pix-create').hidden = pending || value.status === 'PAID';
    if (value.status === 'PAID') {
      message(test ? 'Pagamento de teste confirmado. A assinatura real permanece inalterada.'
        : `Pagamento confirmado! Acesso Premium até ${date(value.expiresAt)}.`);
      if (!test) $('pix-profile').hidden = false;
    } else if (value.status === 'REVERSED') {
      message('Pagamento estornado. Consulte a situação do seu acesso no perfil.', true);
    } else if (!pending) {
      checkoutKey = window.crypto.randomUUID();
      message('Esta cobrança foi encerrada. Você pode gerar um novo Pix.');
    } else {
      message(value.pixCode ? (test ? 'Pedido de teste criado. Clique em “Verificar pagamento” para acompanhar a aprovação simulada.'
        : 'Pix gerado. Após o pagamento, acompanharemos a confirmação automaticamente por até 3 minutos. Você também pode clicar em “Verificar pagamento”.')
        : 'O Mercado Pago está preparando o pedido. Clique em “Verificar pagamento” em alguns instantes.');
    }
  }
  async function run(operation) {
    if (busy) return;
    busy = true;
    clearTimeout(timer);
    $('pix-create').disabled = true;
    $('pix-refresh').disabled = true;
    $('pix-loading').hidden = false;
    try {
      const result = await operation();
      failures = 0;
      if (result) render(result);
    } catch (error) {
      failures++;
      message(error.message || 'Não foi possível concluir. Tente novamente.', true);
    } finally {
      busy = false;
      $('pix-create').disabled = false;
      $('pix-refresh').disabled = false;
      $('pix-loading').hidden = true;
      schedule();
    }
  }
  $('pix-create').addEventListener('click', () => run(() => window.api.post('/payments/checkout', { paymentMethod: 'PIX', requestKey: checkoutKey })));
  $('pix-refresh').addEventListener('click', refresh);
  $('pix-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('pix-code').value);
      message('Código Pix copiado.');
    } catch {
      $('pix-code').focus(); $('pix-code').select();
      message('Selecione o código acima e copie manualmente.');
    }
  });
  async function init() {
    if (!window.api.getToken()) {
      $('pix-login').hidden = false;
      message('Entre na sua conta para gerar o Pix.');
      return;
    }
    try {
      const status = await window.api.get('/payments/status');
      if (!status) return;
      $('pix-test').hidden = status.checkout?.environment !== 'test';
      if (!status.checkout?.enabled) { message('As assinaturas ainda não estão disponíveis. Seu acesso atual permanece conforme o perfil.'); return; }
      if (status.pendingChargeId) {
        await run(() => window.api.get(`/payments/charges/${encodeURIComponent(status.pendingChargeId)}`));
        if (charge) return;
      }
      $('pix-create').hidden = false;
      $('pix-create').textContent = status.isPremium ? 'Renovar por mais 30 dias' : 'Gerar Pix de R$ 24,99';
      message(status.checkout.environment === 'test' ? 'Ambiente de testes pronto. Você poderá conferir a criação e a confirmação de um pedido.'
        : 'Assine por Pix. A liberação ocorre após a confirmação pelo Mercado Pago.');
    } catch (error) { message(error.message || 'Não foi possível consultar seu plano.', true); }
  }
  init();
})();
