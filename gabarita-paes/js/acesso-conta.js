(() => {
  'use strict';
  const paidStart = Date.parse('2026-10-22T03:00:00.000Z');
  const day = 86400000;
  const styleUrl = document.currentScript?.src ? new URL('../css/acesso-renovacao.css?v=20261009-01', document.currentScript.src).href : 'css/acesso-renovacao.css?v=20261009-01';
  const date = value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const label = time => new Date(time).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}) + ' (horário de Brasília)';
  function init() {
    const panel = document.getElementById('account-access');
    // O perfil atualizado tem seu próprio componente e consulta de validade.
    if (!panel || panel.dataset.accessPage === 'profile' || /\/perfil\.html$/.test(location.pathname)) return;
    if (!document.getElementById('access-renewal-style')) {
      const sheet = document.createElement('link'); sheet.id = 'access-renewal-style'; sheet.rel = 'stylesheet'; sheet.href = styleUrl; document.head.append(sheet);
    }
    let status = null, loading = false, lastLoaded = 0, failed = false;
    function render() {
      const now = Date.now(), logged = !!window.api?.getToken();
      const premiumEnd = date(status?.premiumEndsAt), schoolEnd = date(status?.schoolEndsAt);
      const paid = logged && (status?.isPremium === true || status?.accessReason === 'PREMIUM') && premiumEnd !== null && premiumEnd > now;
      const school = logged && schoolEnd !== null && schoolEnd > now;
      let title, text, detail = '', action = null, state = 'info';
      if (!logged) {
        title = 'Prepare-se com o Gabarita Paes';
        text = now < paidStart ? 'Acesso geral gratuito até 21/10/2026. A partir de 22/10, o acesso integral custará R$ 24,99 por 30 dias. Convites escolares válidos serão preservados.' : 'Treine com a seleção gratuita de 50% do banco ENEM. O acesso integral custa R$ 24,99 por 30 dias.';
        action = ['login.html', 'Entrar na minha conta'];
      } else if (failed) {
        // Falha de rede não equivale a vencimento e não fecha nenhuma atividade.
        panel.hidden = true; return;
      } else if (!status) {
        panel.hidden = true; return;
      } else if (paid) {
        title = 'Assinatura ativa'; text = `Acesso integral até ${label(premiumEnd)}.`;
        const remaining = premiumEnd - now;
        if (remaining <= 5 * day) {
          state = 'renewal'; const days = Math.ceil(remaining / day);
          title = days === 1 ? 'Sua assinatura vence em até 1 dia' : `Sua assinatura vence em até ${days} dias`;
          detail = 'Renove antecipadamente sem perder os dias restantes. Os novos 30 dias são somados à validade atual; não há renovação automática.';
          action = ['assinatura.html', 'Renovar acesso'];
        }
      } else if (school) {
        title = 'Acesso escolar ativo'; text = `Benefício válido até ${label(schoolEnd)}. Não há cobrança automática.`;
      } else if (status.accessReason === 'TEMPORARY_FREE' && now < paidStart) {
        title = 'Acesso geral gratuito até 21/10/2026';
        text = 'Continue praticando com acesso completo. A partir de 22/10, o acesso integral custará R$ 24,99 por 30 dias. Não haverá cobrança automática.';
        action = ['assinatura.html', 'Consultar assinatura'];
      } else if (status.canAccess === true && now < paidStart) {
        title = 'Acesso integral disponível'; text = 'Continue praticando. A fase paga começa em 22/10/2026.';
      } else if (status.canAccess === false || (premiumEnd !== null && premiumEnd <= now && !school) || (status.accessReason === 'TEMPORARY_FREE' && now >= paidStart)) {
        state = 'expired'; title = 'Acesso integral encerrado';
        text = 'Para acessar simulados PAES, redação e ranking, é necessário ter assinatura ou convite escolar válido.';
        detail = 'O treino ENEM permanece disponível com a seleção gratuita de 50% do banco.';
        action = ['assinatura.html', premiumEnd !== null && premiumEnd <= now ? 'Renovar acesso' : 'Assinar por R$ 24,99'];
      } else {
        panel.hidden = true; return;
      }
      if (school && paid) detail += ` Seu benefício escolar permanece válido até ${label(schoolEnd)}.`;
      panel.replaceChildren(); panel.dataset.accessState = state;
      panel.setAttribute('aria-label', 'Situação do acesso ao Gabarita Paes');
      panel.setAttribute('aria-live', 'polite');
      const copy = document.createElement('div'); copy.className = 'account-access-copy';
      const heading = document.createElement('h2'); heading.textContent = title;
      const paragraph = document.createElement('p'); paragraph.textContent = text; copy.append(heading, paragraph);
      if (detail) { const note = document.createElement('p'); note.textContent = detail; copy.append(note); }
      panel.append(copy);
      if (action) {
        const actions = document.createElement('div'); actions.className = 'account-access-actions';
        const link = document.createElement('a'); link.href = action[0]; link.className = 'btn'; link.textContent = action[1]; actions.append(link);
        if (state === 'expired') { const practice = document.createElement('a'); practice.href = 'treino-enem.html'; practice.className = 'btn btn-secondary'; practice.textContent = 'Continuar treino ENEM'; actions.append(practice); }
        panel.append(actions);
      }
      panel.hidden = false;
    }
    async function load() {
      if (loading) return;
      if (!window.api?.getToken()) { status = null; failed = false; render(); return; }
      loading = true;
      try {
        const value = await window.api.get('/payments/status');
        if (!value || typeof value.canAccess !== 'boolean') throw new Error('status');
        status = value; failed = false; lastLoaded = Date.now();
      } catch (_) { status = null; failed = true; }
      finally { loading = false; render(); }
    }
    load();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastLoaded >= 60000) load(); });
    setInterval(() => {
      if (document.hidden) return;
      // Reconsulta no máximo a cada cinco minutos para captar renovação em outra aba.
      if (window.api?.getToken() && Date.now() - lastLoaded >= 300000) load(); else render();
    }, 60000);
    // Apenas informa; permissões continuam sendo verificadas pelo backend.
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
