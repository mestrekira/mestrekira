(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const mode = document.body.dataset.paymentPage;
  const message = get('payment-message');
  const check = get('payment-check');
  const create = get('payment-create');
  const consent = get('payment-consent');
  const login = get('payment-login');
  const recover = get('payment-recover');
  const recoverConsent = get('payment-recover-consent');
  let busy = false, enabled = false, charge = null, requestKey = null, references = null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function say(text) { message.textContent = text; }
  function buttons() {
    if (create) create.disabled = busy || !enabled || !consent.checked || !!charge;
    check.disabled = busy;
    if (recover) recover.disabled = busy || !enabled || !recoverConsent.checked || charge?.canRetryLink !== true;
    const submit = login.querySelector('button');
    submit.disabled = busy;
  }
  function askLogin() { enabled = false; login.hidden = false; say('Entre com sua conta do Gabarita Paes para continuar nesta página.'); buttons(); }
  // Mesmo token do api.js. Esta requisição mantém a página de retorno aberta em
  // caso de sessão expirada, em vez de perder as referências no redirecionamento.
  async function request(path, body) {
    if (!window.api || !window.api.getToken()) { askLogin(); return null; }
    const response = await fetch('https://mestrekira-api.onrender.com' + path, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.api.getToken()}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) { askLogin(); return null; }
    let data;
    try { data = await response.json(); } catch { throw new Error('O servidor retornou uma resposta inválida. Tente consultar novamente.'); }
    if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'Não foi possível concluir a consulta.');
    return data;
  }
  function renderCharge(value) {
    if (!value || value.provider !== 'infinitepay' || value.environment !== 'production' || typeof value.pilot !== 'boolean' || (mode === 'test' && value.pilot !== true) || (mode === 'commercial' && value.pilot !== false) || value.realPayment !== true || value.amount !== 24.99 || !uuid.test(value.chargeId || '')) throw new Error('A resposta do pedido não corresponde a esta página de pagamento.');
    charge = value;
    get('payment-result').hidden = false;
    get('payment-order').textContent = `Pedido: ${value.chargeId}`;
    const labels = { CREATING: 'Criação aguardando conferência', PENDING: 'Aguardando pagamento', PAID: 'Pagamento confirmado pelo backend' };
    get('payment-status').textContent = labels[value.status] || 'Status não reconhecido';
    get('payment-open').hidden = true;
    get('payment-open').removeAttribute('href');
    if (get('payment-recovery')) get('payment-recovery').hidden = !(mode === 'test' && enabled && value.canRetryLink === true);
    if (value.checkoutUrl && value.status === 'PENDING') {
      let url;
      try { url = new URL(value.checkoutUrl); } catch { throw new Error('Link de pagamento inválido.'); }
      if (url.protocol !== 'https:' || !['checkout.infinitepay.com.br', 'checkout.infinitepay.io'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Link fora do domínio autorizado.');
      get('payment-open').href = url.href;
      get('payment-open').hidden = false;
    }
    if (value.status === 'PAID') say(value.pilot ? 'Pagamento de piloto confirmado. Este pedido não ativa assinatura.' : value.accessActivated && value.accessGrantedUntil ? `Pagamento confirmado. Acesso integral válido até ${new Date(value.accessGrantedUntil).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.` : 'Pagamento registrado. A ativação do acesso precisa de conferência.');
    else if (value.blockedCheckoutHost) say(`O link foi preservado, mas o domínio precisa de conferência: ${value.blockedCheckoutHost}. Não crie outro pedido.`);
    else if (value.status === 'CREATING') say(value.canRetryLink === true ? 'O pedido ficou sem link salvo. Se você não recebeu o link e não efetuou pagamento, pode autorizar uma única tentativa de recuperação abaixo.' : 'O pedido foi reservado e precisa de conferência. Aguarde e consulte novamente; não crie outro pagamento.');
    else say('Pedido registrado. Ao abrir o checkout, confira o recebedor e o valor de R$ 24,99 antes de pagar.');
    buttons();
  }
  async function run(action) {
    if (busy) return;
    busy = true; buttons();
    try { await action(); } catch (error) { say(error?.message || 'Falha de conexão. Consulte o pedido existente antes de tentar novamente.'); }
    finally { busy = false; buttons(); }
  }
  function parseReturn() {
    const query = new URLSearchParams(window.location.search);
    const names = ['order_nsu', 'transaction_nsu', 'slug'];
    if (names.some(name => query.getAll(name).length !== 1)) throw new Error('O retorno está incompleto ou tem parâmetros repetidos. Volte ao checkout do pedido e use “Continuar”.');
    const order = query.get('order_nsu'), transaction = query.get('transaction_nsu'), slug = query.get('slug');
    if (!uuid.test(order) || !/^[a-zA-Z0-9_-]{1,100}$/.test(transaction) || !/^[a-zA-Z0-9_-]{1,200}$/.test(slug)) throw new Error('As referências do retorno são inválidas. Nenhum pagamento foi confirmado por esta página.');
    return { order, transaction, slug };
  }
  async function load() {
    if (mode === 'return') {
      if (!references) return;
      say('Consultando o pedido da sua conta…');
      const result = await request(`/payments/infinitepay/charges/${encodeURIComponent(references.order)}`);
      if (!result) return;
      renderCharge(result);
      if (result.status !== 'PAID') {
        say('Conferindo o pagamento na API da InfinitePay…');
        const confirmed = await request(`/payments/infinitepay/charges/${encodeURIComponent(references.order)}/confirm`, { transaction_nsu: references.transaction, slug: references.slug });
        if (confirmed) renderCharge(confirmed);
      }
      return;
    }
    if (charge) {
      const result = await request(`/payments/infinitepay/charges/${encodeURIComponent(charge.chargeId)}`);
      if (result) renderCharge(result);
      return;
    }
    say('Consultando autorização…');
    const result = await request('/payments/infinitepay/status');
    if (!result) return;
    const config = result.checkout;
    enabled = config?.enabled === true && config?.provider === 'infinitepay' && config?.pilot === (mode !== 'commercial') && config?.environment === 'production' && config?.realPayment === true && config?.accessActivationEnabled === (mode === 'commercial') && config?.amount === 24.99;
    login.hidden = true;
    say(enabled ? 'Conta autorizada. Marque a confirmação abaixo para habilitar a geração de um único link.' : (mode === 'commercial' ? 'A assinatura será disponibilizada a partir de 22/10/2026. Se essa data já chegou, a cobrança ainda está desativada; entre em contato com o suporte.' : 'O piloto está desativado ou esta conta não está autorizada.'));
    if (result.pendingCharge) renderCharge(result.pendingCharge);
    buttons();
  }
  check.addEventListener('click', () => run(load));
  if (consent) consent.addEventListener('change', buttons);
  if (recoverConsent) recoverConsent.addEventListener('change', buttons);
  if (recover) recover.addEventListener('click', () => run(async () => {
    if (!enabled || !recoverConsent.checked || charge?.canRetryLink !== true) return;
    say('Solicitando uma única recuperação do link para o pedido existente…');
    // Desabilita uma segunda tentativa local mesmo se a resposta for perdida.
    const chargeId = charge.chargeId;
    charge.canRetryLink = false;
    buttons();
    const result = await request(`/payments/infinitepay/charges/${encodeURIComponent(chargeId)}/retry-link`, { acknowledgeNoLinkAndNoPayment: true });
    if (result) renderCharge(result);
  }));
  if (create) create.addEventListener('click', () => run(async () => {
    if (!enabled || !consent.checked || charge) return;
    requestKey = requestKey || crypto.randomUUID();
    say('Gerando um único link de pagamento…');
    const result = await request('/payments/infinitepay/checkout', { requestKey });
    if (result) renderCharge(result);
  }));
  login.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      if (!window.api) throw new Error('O arquivo js/api.js não carregou.');
      const result = await window.api.post('/auth/login', { email: get('payment-email').value.trim(), password: get('payment-password').value });
      if (result?.ok === false || result?.error) throw new Error(typeof result.error === 'string' ? result.error : 'Não foi possível entrar.');
      const token = result?.token || result?.accessToken || result?.access_token || result?.jwt || result?.data?.token || result?.data?.accessToken;
      if (typeof token !== 'string' || !token) throw new Error('O servidor não retornou uma sessão válida.');
      window.api.setToken(token);
      get('payment-password').value = '';
      login.hidden = true;
      await load();
    });
  });
  if (mode === 'return') {
    try { references = parseReturn(); }
    catch (error) { say(error.message); check.disabled = true; return; }
  }
  buttons();
  run(load);
})();
