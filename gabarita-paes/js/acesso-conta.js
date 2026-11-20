/* Situação da assinatura, acesso escolar e renovação. */
(() => {
  'use strict';

  const paidStart = Date.parse('2026-10-22T03:00:00.000Z');
  const day = 86400000;

  const styleUrl = document.currentScript?.src
    ? new URL(
        '../css/acesso-renovacao.css?v=20261009-01',
        document.currentScript.src
      ).href
    : 'css/acesso-renovacao.css?v=20261009-01';

  const date = value =>
    typeof value === 'string' &&
    value.trim() &&
    Number.isFinite(Date.parse(value))
      ? Date.parse(value)
      : null;

  const label = time =>
    new Date(time).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }) + ' (horário de Brasília)';

  function init() {
    const panel = document.getElementById('account-access');

    // O perfil possui seu próprio componente de validade.
    if (
      !panel ||
      panel.dataset.accessPage === 'profile' ||
      /\/perfil\.html$/.test(location.pathname)
    ) {
      return;
    }

    if (!document.getElementById('access-renewal-style')) {
      const sheet = document.createElement('link');
      sheet.id = 'access-renewal-style';
      sheet.rel = 'stylesheet';
      sheet.href = styleUrl;
      document.head.append(sheet);
    }

    let status = null;
    let loading = false;
    let lastLoaded = 0;
    let failed = false;

    function render() {
      const now = Date.now();
      const logged = !!window.api?.getToken();

      const premiumEnd = date(status?.premiumEndsAt);
      const schoolEnd = date(status?.schoolEndsAt);

      const paid =
        logged &&
        (
          status?.isPremium === true ||
          status?.accessReason === 'PREMIUM'
        ) &&
        premiumEnd !== null &&
        premiumEnd > now;

      const school =
        logged &&
        schoolEnd !== null &&
        schoolEnd > now;

      let title;
      let text;
      let detail = '';
      let action = null;
      let state = 'info';

      if (!logged) {
        title = 'Prepare-se com o Gabarita Paes';

        text = now < paidStart
          ? 'Acesso geral gratuito até 21/10/2026. A partir de 22/10, o acesso integral custará R$ 24,99 por 30 dias. Convites escolares válidos serão preservados.'
          : 'Treine com a seleção gratuita de 50% do banco ENEM. O acesso integral custa R$ 24,99 por 30 dias.';

        action = ['login.html', 'Entrar na minha conta'];
      } else if (failed || !status) {
        // Falha de consulta não equivale a acesso vencido.
        panel.hidden = true;
        return;
      } else if (paid) {
        title = 'Assinatura ativa';
        text = `Acesso integral até ${label(premiumEnd)}.`;

        const remaining = premiumEnd - now;

        if (remaining <= 5 * day) {
          state = 'renewal';
          const days = Math.ceil(remaining / day);

          title = days === 1
            ? 'Sua assinatura vence em até 1 dia'
            : `Sua assinatura vence em até ${days} dias`;

          detail =
            'Renove antecipadamente sem perder os dias restantes. Os novos 30 dias são somados à validade atual; não há renovação automática.';

          action = ['assinatura.html', 'Renovar acesso'];
        }
      } else if (school) {
        title = 'Acesso escolar ativo';
        text =
          `Benefício válido até ${label(schoolEnd)}. Não há cobrança automática.`;
      } else if (
        status.accessReason === 'TEMPORARY_FREE' &&
        now < paidStart
      ) {
        title = 'Acesso geral gratuito até 21/10/2026';
        text =
          'Continue praticando com acesso completo. A partir de 22/10, o acesso integral custará R$ 24,99 por 30 dias. Não haverá cobrança automática.';

        action = ['assinatura.html', 'Consultar assinatura'];
      } else if (
        status.canAccess === true &&
        now < paidStart
      ) {
        title = 'Acesso integral disponível';
        text =
          'Continue praticando. A fase paga começa em 22/10/2026.';
      } else if (
        status.canAccess === false ||
        (
          premiumEnd !== null &&
          premiumEnd <= now &&
          !school
        ) ||
        (
          status.accessReason === 'TEMPORARY_FREE' &&
          now >= paidStart
        )
      ) {
        state = 'expired';
        title = 'Acesso integral encerrado';
        text =
          'Para acessar simulados PAES, redação e ranking, é necessário ter assinatura ou convite escolar válido.';

        detail =
          'O treino ENEM permanece disponível com a seleção gratuita de 50% do banco.';

        action = [
          'assinatura.html',
          premiumEnd !== null && premiumEnd <= now
            ? 'Renovar acesso'
            : 'Assinar por R$ 24,99',
        ];
      } else {
        panel.hidden = true;
        return;
      }

      if (school && paid) {
        detail +=
          ` Seu benefício escolar permanece válido até ${label(schoolEnd)}.`;
      }

      panel.replaceChildren();
      panel.dataset.accessState = state;
      panel.setAttribute(
        'aria-label',
        'Situação do acesso ao Gabarita Paes'
      );
      panel.setAttribute('aria-live', 'polite');

      const copy = document.createElement('div');
      copy.className = 'account-access-copy';

      const heading = document.createElement('h2');
      heading.textContent = title;

      const paragraph = document.createElement('p');
      paragraph.textContent = text;

      copy.append(heading, paragraph);

      if (detail) {
        const note = document.createElement('p');
        note.textContent = detail;
        copy.append(note);
      }

      panel.append(copy);

      if (action) {
        const actions = document.createElement('div');
        actions.className = 'account-access-actions';

        const link = document.createElement('a');
        link.href = action[0];
        link.className = 'btn';
        link.textContent = action[1];
        actions.append(link);

        if (state === 'expired') {
          const practice = document.createElement('a');
          practice.href = 'treino-enem.html';
          practice.className = 'btn btn-secondary';
          practice.textContent = 'Continuar treino ENEM';
          actions.append(practice);
        }

        panel.append(actions);
      }

      panel.hidden = false;
    }

    async function load() {
      if (loading) return;

      if (!window.api?.getToken()) {
        status = null;
        failed = false;
        render();
        return;
      }

      loading = true;

      try {
        const value = await window.api.get('/payments/status');

        if (!value || typeof value.canAccess !== 'boolean') {
          throw new Error('Status indisponível.');
        }

        status = value;
        failed = false;
        lastLoaded = Date.now();
      } catch {
        status = null;
        failed = true;
      } finally {
        loading = false;
        render();
      }
    }

    load();

    document.addEventListener('visibilitychange', () => {
      if (
        !document.hidden &&
        Date.now() - lastLoaded >= 60000
      ) {
        load();
      }
    });

    setInterval(() => {
      if (document.hidden) return;

      if (
        window.api?.getToken() &&
        Date.now() - lastLoaded >= 300000
      ) {
        load();
      } else {
        render();
      }
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();


/* Aviso temporário do simulado extra. */
;(() => {
  'use strict';

  // 23/11/2026, às 00h de Brasília.
  const endsAt = Date.parse('2026-11-23T03:00:00.000Z');

  const key = 'gabarita-extra-notice-20261122-v1';
  const id = 'gabarita-extra-invitation';
  const path = location.pathname.toLowerCase();

  // Evita interromper login, pagamento e a própria página do extra.
  if (
    /\/(login|cadastro|simulado-extra|assinatura|verificar-email|recuperar-senha|redefinir-senha)\.html$/.test(path)
  ) {
    return;
  }

  function create(tag, text, className) {
    const element = document.createElement(tag);

    if (text != null) element.textContent = text;
    if (className) element.className = className;

    return element;
  }

  function seen() {
    try {
      return sessionStorage.getItem(key) === 'seen';
    } catch {
      return false;
    }
  }

  function remember() {
    try {
      sessionStorage.setItem(key, 'seen');
    } catch {
      // O aviso continua funcional sem armazenamento.
    }
  }

  async function init() {
    if (
      Date.now() >= endsAt ||
      seen() ||
      document.getElementById(id) ||
      !window.api?.getToken()
    ) {
      return;
    }

    // Não interrompe um simulado já iniciado nesta aba.
    if (
      typeof examRunning !== 'undefined' &&
      examRunning
    ) {
      return;
    }

    let response;

    try {
      response = await window.api.get('/simulation-extras');
    } catch {
      return;
    }

    if (
      !response?.items?.length ||
      Date.now() >= endsAt ||
      seen() ||
      document.getElementById(id)
    ) {
      return;
    }

    if (
      typeof examRunning !== 'undefined' &&
      examRunning
    ) {
      return;
    }

    if (document.querySelector('dialog[open]')) return;

    const dialog = create('dialog');

    // O card da página de simulado continua sendo uma alternativa.
    if (typeof dialog.showModal !== 'function') return;

    dialog.id = id;
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute(
      'aria-describedby',
      `${id}-description`
    );

    const style = create('style');

    style.textContent = `
      #${id} {
        width: calc(100% - 32px);
        max-width: 560px;
        max-height: calc(100dvh - 40px);
        padding: 0;
        border: 0;
        border-radius: 22px;
        background: #fff;
        color: #172554;
        box-shadow: 0 24px 80px #0f172a55;
        overflow: auto;
        font: 16px/1.6 system-ui, -apple-system,
          "Segoe UI", sans-serif;
      }

      #${id}::backdrop {
        background: rgb(15 23 42 / 65%);
        backdrop-filter: blur(4px);
      }

      #${id},
      #${id} * {
        box-sizing: border-box;
      }

      #${id} .extra-invite-hero {
        position: relative;
        padding: 32px 28px 26px;
        background: linear-gradient(135deg, #132248, #1e3a8a);
        color: #fff;
      }

      #${id} .extra-invite-badge {
        display: inline-block;
        max-width: calc(100% - 32px);
        padding: 5px 12px;
        border-radius: 30px;
        background: #fef3c7;
        color: #713f12;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .02em;
      }

      #${id} h2 {
        color: #fff;
        font-size: clamp(25px, 5vw, 32px);
        line-height: 1.2;
        margin: 18px 0 10px;
      }

      #${id} .extra-invite-hero p {
        color: #e0e7ff;
        margin: 0;
      }

      #${id} .extra-invite-close {
        position: absolute;
        right: 12px;
        top: 12px;
        width: 38px;
        height: 38px;
        border: 1px solid #ffffff55;
        border-radius: 50%;
        background: #ffffff15;
        color: #fff;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
      }

      #${id} .extra-invite-body {
        padding: 24px 28px 26px;
      }

      #${id} .extra-invite-body p {
        margin: 0 0 16px;
      }

      #${id} .extra-invite-features {
        display: grid;
        gap: 10px;
        margin: 0 0 20px;
        padding: 0;
        list-style: none;
      }

      #${id} .extra-invite-features li {
        padding: 10px 12px;
        border-radius: 10px;
        background: #f1f5ff;
        color: #1e3a8a;
      }

      #${id} .extra-invite-requirements {
        padding: 14px;
        border-left: 3px solid #eab308;
        background: #fffbeb;
        border-radius: 8px;
        font-size: 14px;
        color: #713f12;
      }

      #${id} .extra-invite-cta {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 50px;
        padding: 12px 16px;
        border-radius: 10px;
        background: #facc15;
        color: #172554;
        border: 1px solid #eab308;
        text-decoration: none;
        font-weight: 800;
        text-align: center;
      }

      #${id} .extra-invite-cta:hover {
        background: #fde047;
      }

      #${id} .extra-invite-later {
        display: block;
        margin: 12px auto 0;
        padding: 8px 16px;
        border: 0;
        background: transparent;
        color: #475569;
        cursor: pointer;
        font: inherit;
      }

      #${id} a:focus-visible,
      #${id} button:focus-visible {
        outline: 3px solid #2563eb;
        outline-offset: 3px;
      }

      #${id} .extra-invite-footnote {
        display: block;
        margin-top: 16px;
        color: #64748b;
        text-align: center;
        font-size: 12px;
      }

      @media (max-width: 480px) {
        #${id} {
          border-radius: 16px;
        }

        #${id} .extra-invite-hero {
          padding: 28px 20px 22px;
        }

        #${id} .extra-invite-body {
          padding: 20px;
        }
      }
    `;

    const hero = create('div', null, 'extra-invite-hero');

    const closeButton = create(
      'button',
      '×',
      'extra-invite-close'
    );

    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Fechar aviso');

    const title = create(
      'h2',
      'Mais uma chance de testar sua preparação!'
    );
    title.id = `${id}-title`;

    const description = create(
      'p',
      'Um simulado extra chegou ao Gabarita Paes para reforçar sua revisão antes da prova.'
    );
    description.id = `${id}-description`;

    hero.append(
      closeButton,
      create(
        'span',
        'RETA FINAL · SIMULADO EXTRA',
        'extra-invite-badge'
      ),
      title,
      description
    );

    const body = create('div', null, 'extra-invite-body');

    const unlocked = response.items.some(
      item => item.unlocked === true
    );

    body.append(
      create(
        'p',
        unlocked
          ? 'Você já cumpriu os requisitos! Aproveite o extra para conferir o que aprendeu e revisar os pontos que ainda merecem atenção.'
          : 'Concluiu o simulado do ciclo ativo? Continue sua preparação com novas questões e mais uma oportunidade de praticar a redação.'
      )
    );

    const features = create(
      'ul',
      null,
      'extra-invite-features'
    );

    [
      'Novas questões e revisão dos erros.',
      'Temas extras para praticar sua redação.',
      'Progresso salvo, sem alterar seu ranking oficial.',
    ].forEach(text => {
      features.append(create('li', text));
    });

    body.append(features);

    if (!unlocked) {
      body.append(
        create(
          'p',
          'Para liberar: conclua o simulado oficial e envie pelo menos uma redação do ciclo ativo. É necessário ter assinatura ou acesso escolar válido.',
          'extra-invite-requirements'
        )
      );
    }

    const link = create(
      'a',
      unlocked
        ? 'Quero fazer o simulado extra'
        : 'Conhecer o extra e conferir minha liberação',
      'extra-invite-cta'
    );

    link.href = 'simulado-extra.html';

    const later = create(
      'button',
      'Continuar na plataforma',
      'extra-invite-later'
    );
    later.type = 'button';

    body.append(
      link,
      later,
      create(
        'small',
        'Você também encontra o extra na página de simulado.',
        'extra-invite-footnote'
      )
    );

    dialog.append(hero, body);
    document.head.append(style);
    document.body.append(dialog);

    const previousFocus = document.activeElement;
    let timer;

    function cleanup() {
      clearTimeout(timer);
      document.removeEventListener(
        'visibilitychange',
        checkExpiry
      );

      dialog.remove();
      style.remove();

      if (
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      ) {
        previousFocus.focus();
      }
    }

    function dismiss() {
      if (dialog.open) {
        dialog.close();
      } else {
        cleanup();
      }
    }

    function checkExpiry() {
      if (Date.now() >= endsAt) dismiss();
    }

    closeButton.addEventListener('click', dismiss);
    later.addEventListener('click', dismiss);

    dialog.addEventListener(
      'close',
      cleanup,
      { once: true }
    );

    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;

      const box = dialog.getBoundingClientRect();

      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      ) {
        dismiss();
      }
    });

    dialog.addEventListener('cancel', remember);
    link.addEventListener('click', remember);

    try {
      dialog.showModal();
    } catch {
      cleanup();
      return;
    }

    remember();
    link.focus();

    timer = setTimeout(
      checkExpiry,
      Math.min(endsAt - Date.now(), 2147483647)
    );

    document.addEventListener(
      'visibilitychange',
      checkExpiry
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
