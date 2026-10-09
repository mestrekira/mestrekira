(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const message = get('test-message');
  const create = get('test-create');
  const refresh = get('test-refresh');
  let permitted = false, busy = false, chargeId = null, paid = false, requestKey = null;
  function buttons() { create.disabled = !permitted || busy || !!chargeId || paid; refresh.disabled = !permitted || busy || !chargeId; }
  function display(charge) {
    if (!charge || charge.environment !== 'test') throw new Error('Resposta fora do ambiente de teste. Operação interrompida.');
    chargeId = charge.chargeId;
    paid = charge.status === 'PAID';
    get('test-result').hidden = false;
    get('test-status').textContent = `Situação: ${charge.status}. Ambiente: teste.`;
    get('test-charge-id').textContent = `Identificador interno da cobrança: ${chargeId}`;
    get('test-code').value = charge.pixCode || '';
    const qr = charge.pixQrCode;
    get('test-qr').hidden = !(typeof qr === 'string' && qr.length <= 1000000 && /^[A-Za-z0-9+/=]+$/.test(qr));
    if (!get('test-qr').hidden) get('test-qr').src = `data:image/png;base64,${qr}`;
    else get('test-qr').removeAttribute('src');
    message.textContent = paid ? 'Pagamento de teste confirmado. Nenhuma assinatura real foi ativada. Confira separadamente o log do Webhook no Render.' : 'Cobrança de teste registrada. Você pode consultar novamente para conferir a confirmação simulada. Não faça uma transferência real.';
    buttons();
  }
  async function execute(action) {
    if (busy || !permitted) return;
    busy = true; buttons();
    try { await action(); } catch (error) { message.textContent = error.message || 'Não foi possível concluir o teste. Consulte o log do Render.'; }
    finally { busy = false; buttons(); }
  }
  create.addEventListener('click', () => execute(async () => {
    if (chargeId || paid) return;
    requestKey = requestKey || crypto.randomUUID();
    message.textContent = 'Criando pedido de teste…';
    const result = await window.api.post('/payments/checkout', { paymentMethod: 'PIX', requestKey });
    if (result) display(result);
  }));
  refresh.addEventListener('click', () => execute(async () => {
    message.textContent = 'Consultando pedido…';
    const result = await window.api.get(`/payments/charges/${encodeURIComponent(chargeId)}`);
    if (result) display(result);
  }));
  get('test-copy').addEventListener('click', async () => {
    const code = get('test-code').value;
    if (!code) { message.textContent = 'Ainda não há código Pix disponível.'; return; }
    try { await navigator.clipboard.writeText(code); message.textContent = 'Código de teste copiado. Não efetue pagamento real.'; }
    catch { get('test-code').focus(); get('test-code').select(); message.textContent = 'Selecione e copie o código do campo.'; }
  });
  async function init() {
    if (!window.api || !window.api.getToken()) { message.textContent = 'Faça login com a conta autorizada e retorne a esta página.'; return; }
    try {
      const status = await window.api.get('/payments/status');
      if (!status) return;
      permitted = status.checkout?.enabled === true && status.checkout?.environment === 'test' && status.checkout?.restrictedTest === true;
      if (!permitted) { message.textContent = 'Checkout de teste não autorizado para esta conta ou ainda desativado no backend. Seu acesso gratuito continua disponível.'; return; }
      message.textContent = 'Conta autorizada. Nenhuma cobrança será criada até você clicar em “Gerar Pix de teste”.';
      buttons();
      if (status.pendingChargeId) await execute(async () => display(await window.api.get(`/payments/charges/${encodeURIComponent(status.pendingChargeId)}`)));
    } catch (error) { message.textContent = error.message || 'Não foi possível consultar a autorização.'; }
  }
  buttons();
  init();
})();
