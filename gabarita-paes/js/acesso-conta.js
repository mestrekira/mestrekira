(() => {
  'use strict';
  function dateLabel(value) {
    const date = new Date(value);
    if (!value || !Number.isFinite(date.getTime())) throw new Error('Prazo indisponível.');
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function describeAccess(access) {
    if (!access || typeof access.canAccess !== 'boolean') throw new Error('Acesso indisponível.');
    const full = 'Simulado PAES, redação, ranking e banco ENEM completo disponíveis.';
    switch (access.accessReason) {
      case 'TEMPORARY_FREE':
        if (!access.canAccess) throw new Error('Acesso inconsistente.');
        return { state: 'trial', title: 'Gratuito por tempo limitado',
          detail: 'Acesso completo gratuito durante o lançamento. Depois, R$ 24,99 por 30 dias. A mudança será comunicada com antecedência. Não haverá cobrança automática.', features: full };
      case 'PRELAUNCH':
        if (!access.canAccess) throw new Error('Acesso inconsistente.');
        return { state: 'trial', title: 'Acesso liberado durante os testes',
          detail: `Seus 7 dias gratuitos começam em ${dateLabel(access.trialStartsAt)} e terminam em ${dateLabel(access.trialEndsAt)} (horário de Brasília).`,
          features: full };
      case 'TRIAL': {
        if (!access.canAccess || !Number.isFinite(access.trialRemainingMs) || access.trialRemainingMs <= 0) throw new Error('Atualize o prazo de acesso.');
        const days = Math.ceil(access.trialRemainingMs / 86400000);
        const remaining = days === 1 ? 'Até 24 horas restantes' : `${days} dias restantes`;
        return { state: 'trial', title: `Teste gratuito ativo · ${remaining}`,
          detail: `Acesso completo até ${dateLabel(access.trialEndsAt)} (horário de Brasília).`, features: full };
      }
      case 'PREMIUM':
        if (!access.canAccess) throw new Error('Acesso inconsistente.');
        return { state: 'premium', title: 'Assinatura ativa',
          detail: `Seu acesso está válido até ${dateLabel(access.premiumEndsAt)} (horário de Brasília).`, features: full };
      case 'EXPIRED':
        if (access.canAccess) throw new Error('Acesso inconsistente.');
        return { state: 'expired', title: 'Seu teste gratuito terminou',
          detail: `O período gratuito terminou em ${dateLabel(access.trialEndsAt)} (horário de Brasília).`,
          features: 'Você pode continuar no treino ENEM com 50% do banco. Simulado PAES, redação e ranking exigem acesso completo.',
          link: { href: 'assinar.html', text: 'Conhecer o plano' } };
      default: throw new Error('Situação de acesso desconhecida.');
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function render(panel, model) {
    panel.replaceChildren();
    panel.dataset.accessState = model.state;
    const copy = element('div', 'account-access-copy');
    copy.append(element('h2', '', model.title), element('p', '', model.detail));
    if (model.features) copy.append(element('p', 'account-access-features', model.features));
    panel.append(copy);
    const actions = element('div', 'account-access-actions');
    if (model.link && !(model.link.href === 'assinar.html' && panel.dataset.accessPage === 'plan')) {
      const link = element('a', 'btn btn-secondary', model.link.text);
      link.href = model.link.href;
      actions.append(link);
    }
    panel.append(actions);
    panel.hidden = false;
    return actions;
  }

  async function load(panel) {
    if (panel.dataset.loading === 'true') return;
    panel.dataset.loading = 'true';
    panel.setAttribute('aria-busy', 'true');
    try {
      if (!window.api?.getToken()) {
        render(panel, { state: 'guest', title: 'Conheça seu acesso',
          detail: 'O Gabarita PAES está gratuito por tempo limitado. Depois, o acesso completo custará R$ 24,99 por 30 dias. A mudança será comunicada com antecedência. Não haverá cobrança automática.',
          link: { href: 'login.html', text: 'Entrar na minha conta' } });
        return;
      }
      const profile = await window.api.get('/users/me');
      if (!profile) return; // API já encaminha sessões expiradas ao login.
      render(panel, describeAccess(profile.paesAccess));
      const name = document.getElementById('user-name');
      if (name && typeof profile.name === 'string') name.textContent = `👤 ${profile.name.trim().split(/\s+/)[0]}`;
    } catch (_) {
      render(panel, { state: 'unknown', title: 'Não foi possível consultar seu acesso',
        detail: 'Tente novamente para conferir o prazo do teste ou da assinatura.' });
    } finally {
      panel.dataset.loading = 'false';
      panel.setAttribute('aria-busy', 'false');
      if (window.api?.getToken() && !panel.hidden) {
        const button = element('button', 'btn btn-secondary', 'Atualizar acesso');
        button.type = 'button';
        button.addEventListener('click', () => load(panel));
        panel.querySelector('.account-access-actions')?.append(button);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('account-access');
    if (panel) load(panel);
  });
})();
