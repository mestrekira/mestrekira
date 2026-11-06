(function () {
  'use strict';

  let obrasUserId = null;
  let obrasAccessPromise = null;

  const inicializados = new WeakSet();

  // 1. Autenticação e autorização

  function inicializarAutenticacao() {
    if (obrasAccessPromise) return obrasAccessPromise;

    obrasAccessPromise = verificarAcessoObras();
    return obrasAccessPromise;
  }

  async function verificarAcessoObras() {
    document.documentElement.removeAttribute('data-obras-access');
    obrasUserId = null;

    let painel = document.getElementById('obras-access-message');

    if (!painel) {
      painel = document.createElement('section');
      painel.id = 'obras-access-message';
      painel.className = 'card';
      painel.style.cssText =
        'max-width:760px;margin:32px auto;padding:24px;';
      painel.setAttribute('aria-live', 'polite');

      const main = document.querySelector('main');

      if (main) {
        main.before(painel);
      } else {
        document.body.append(painel);
      }
    }

    painel.hidden = false;

    function mensagem(titulo, texto, acoes = []) {
      const h2 = document.createElement('h2');
      h2.textContent = titulo;

      const p = document.createElement('p');
      p.textContent = texto;

      painel.replaceChildren(h2, p);

      for (const [rotulo, destino] of acoes) {
        const link = document.createElement('a');

        link.className = 'btn';
        link.style.margin = '8px 8px 0 0';
        link.textContent = rotulo;
        link.href = destino;

        painel.append(link);
      }
    }

    mensagem(
      'Conferindo seu acesso',
      'Aguarde enquanto verificamos sua conta no Gabarita PAES.'
    );

    const api = window.api;

    if (
      !api ||
      typeof api.getToken !== 'function' ||
      typeof api.get !== 'function'
    ) {
      mensagem(
        'Não foi possível verificar o acesso',
        'Recarregue a página. Se o problema continuar, entre em contato com contato@mestrekira.com.br.'
      );

      return false;
    }

    if (!api.getToken()) {
      mensagem(
        'Entre para acessar as obras',
        'Este conteúdo é exclusivo de contas com assinatura ou benefício escolar válido.',
        [
          ['Entrar na minha conta', 'login.html'],
          ['Criar conta', 'cadastro.html']
        ]
      );

      return false;
    }

    try {
      const user = await api.get('/users/me');

      if (
        !user ||
        typeof user.paesAccess?.canAccess !== 'boolean'
      ) {
        throw new Error('Resposta de acesso indisponível.');
      }

      if (!user.paesAccess.canAccess) {
        mensagem(
          'Acesso integral necessário',
          'Para estudar as obras e responder às questões, ative sua assinatura. Participantes com benefício escolar válido também têm acesso.',
          [
            ['Assinar ou renovar acesso', 'assinatura.html'],
            ['Ver meu perfil', 'perfil.html']
          ]
        );

        return false;
      }

      if (
        typeof user.id !== 'string' ||
        !user.id.trim()
      ) {
        throw new Error('Conta não identificada.');
      }

      obrasUserId = user.id;

      const nome = document.getElementById('user-name');

      if (nome) {
        const primeiroNome = String(user.name || 'Aluno')
          .trim()
          .split(/\s+/)[0];

        nome.textContent = `👤 ${primeiroNome}`;
      }

      document.documentElement.setAttribute(
        'data-obras-access',
        'granted'
      );

      painel.hidden = true;
      return true;
    } catch (_) {
      mensagem(
        'Não foi possível verificar o acesso',
        'Não conseguimos consultar sua conta agora. Uma falha de conexão não significa que sua assinatura terminou.',
        [
          ['Entrar novamente', 'login.html'],
          ['Ver meu perfil', 'perfil.html']
        ]
      );

      const retry = document.createElement('button');

      retry.type = 'button';
      retry.className = 'btn btn-secondary';
      retry.textContent = 'Tentar novamente';

      retry.addEventListener(
        'click',
        () => window.location.reload(),
        { once: true }
      );

      painel.append(retry);
      return false;
    }
  }

  function getUserId() {
    return obrasUserId;
  }

  // 2. Compatibilidade dos dados e validação do progresso

  function letra(valor) {
    return String(valor ?? '').trim().toUpperCase();
  }

  function escapar(valor) {
    const caracteres = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return String(valor ?? '').replace(
      /[&<>"']/g,
      (caractere) => caracteres[caractere]
    );
  }

  function normalizarQuestoes(questions) {
    const ids = new Set();

    return questions.map((q) => {
      if (
        !q ||
        !String(q.id ?? '').trim() ||
        !Array.isArray(q.alternativas)
      ) {
        throw new Error('Questão sem identificação ou alternativas.');
      }

      const id = String(q.id).trim();

      if (ids.has(id)) {
        throw new Error('Identificação de questão repetida.');
      }

      ids.add(id);

      const alternativas = q.alternativas.map((alt, indice) => ({
        ...alt,
        letra: letra(
          alt.letra || String.fromCharCode(65 + indice)
        )
      }));

      const letras = alternativas.map((alt) => alt.letra);
      const gabarito = letra(q.gabarito);

      if (
        letras.length < 2 ||
        new Set(letras).size !== letras.length ||
        !letras.includes(gabarito)
      ) {
        throw new Error('Alternativas ou gabarito inválidos.');
      }

      return {
        ...q,
        id,
        alternativas,
        gabarito
      };
    });
  }

  function filtrarProgresso(raw, questoes) {
    const state = Object.create(null);

    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    ) {
      return state;
    }

    for (const q of questoes) {
      if (!Object.prototype.hasOwnProperty.call(raw, q.id)) {
        continue;
      }

      const answer = raw[q.id];

      if (!answer || typeof answer !== 'object') {
        continue;
      }

      const chosen = letra(answer.chosen);

      if (!q.valores.includes(chosen)) {
        continue;
      }

      state[q.id] = {
        chosen,
        isCorrect: chosen === q.correta,
        timestamp:
          typeof answer.timestamp === 'string'
            ? answer.timestamp
            : null
      };
    }

    return state;
  }

  // 3. Motor compartilhado pelos módulos estáticos e dinâmicos

  function inicializarQuizParaContainer(container, moduleId) {
    if (
      !container ||
      !getUserId() ||
      inicializados.has(container)
    ) {
      return;
    }

    const questoes = Array.from(
      container.querySelectorAll('.question-block')
    ).map((block) => {
      const inputs = Array.from(
        block.querySelectorAll('input[type="radio"]')
      );

      return {
        block,
        id: block.getAttribute('data-question-id'),
        correta: letra(
          block.getAttribute('data-correct-answer')
        ),
        inputs,
        valores: inputs.map((input) => letra(input.value))
      };
    });

    if (!questoes.length) return;

    const ids = questoes.map((q) => q.id);

    if (
      ids.some((id) => !id) ||
      new Set(ids).size !== ids.length ||
      questoes.some((q) => !q.valores.includes(q.correta))
    ) {
      const aviso = document.createElement('p');

      aviso.textContent =
        'Não foi possível iniciar as questões. Confira os identificadores e gabaritos deste módulo.';

      container.prepend(aviso);
      return;
    }

    inicializados.add(container);

    const storageKey =
      `gabarita_obras_${getUserId()}_${moduleId}`;

    let state = Object.create(null);

    const storageNotice = document.createElement('p');
    storageNotice.setAttribute('role', 'status');
    storageNotice.hidden = true;

    container.before(storageNotice);

    function avisarArmazenamento() {
      storageNotice.hidden = false;
      storageNotice.textContent =
        'Seu progresso funciona nesta página, mas não foi possível acessar o armazenamento do navegador. Ele pode não ser recuperado ao sair ou recarregar.';
    }

    try {
      const raw = JSON.parse(
        localStorage.getItem(storageKey) || '{}'
      );

      state = filtrarProgresso(raw, questoes);
    } catch (_) {
      avisarArmazenamento();
    }

    let score =
      document.getElementById(`quiz-stats-${moduleId}`) ||
      document.getElementById('quiz-score-badge');

    if (!score) {
      score = document.createElement('div');
      score.id = `quiz-stats-${moduleId}`;
      score.className = 'quiz-score-badge';

      container.before(score);
    }

    score.setAttribute('aria-live', 'polite');

    let reset =
      document.getElementById(`btn-reset-${moduleId}`) ||
      document.getElementById('btn-reset-quiz');

    if (!reset) {
      reset = document.createElement('button');
      reset.type = 'button';
      reset.id = `btn-reset-${moduleId}`;
      reset.className = 'btn btn-secondary';
      reset.textContent = 'Refazer questões';

      container.before(reset);
    }

    function salvar() {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(state)
        );
      } catch (_) {
        avisarArmazenamento();
      }
    }

    function placar() {
      const respostas = Object.values(state);
      const acertos = respostas.filter(
        (resposta) => resposta.isCorrect
      ).length;

      score.textContent =
        `${respostas.length} de ${questoes.length} respondidas | ` +
        `${acertos} acerto(s)`;
    }

    function mostrarResposta(q, chosen) {
      q.inputs.forEach((input) => {
        input.checked = letra(input.value) === chosen;
        input.disabled = true;
      });

      q.block
        .querySelectorAll('.answer-indicator')
        .forEach((el) => el.remove());

      q.block
        .querySelectorAll('.option-label')
        .forEach((label) => {
          label.classList.remove('is-correct', 'is-wrong');

          const input = label.querySelector(
            'input[type="radio"]'
          );

          if (!input) return;

          const value = letra(input.value);
          const correta = value === q.correta;

          if (!correta && value !== chosen) return;

          label.classList.add(
            correta ? 'is-correct' : 'is-wrong'
          );

          const indicator = document.createElement('span');
          indicator.className = 'answer-indicator';

          indicator.textContent = correta
            ? (
                value === chosen
                  ? ' [✓ Sua resposta — correta]'
                  : ' [✓ Gabarito]'
              )
            : ' [✗ Sua resposta — incorreta]';

          label.append(indicator);
        });

      const button = q.block.querySelector(
        '.btn-check-answer'
      );

      if (button) {
        button.disabled = true;
        button.textContent = 'Resposta registrada';
      }

      const feedback = q.block.querySelector(
        '.question-feedback'
      );

      if (feedback) feedback.hidden = false;
    }

    for (const q of questoes) {
      const button = q.block.querySelector(
        '.btn-check-answer'
      );

      const warning = q.block.querySelector(
        '.selection-warning'
      );

      if (state[q.id]) {
        mostrarResposta(q, state[q.id].chosen);
      }

      if (!button) continue;

      button.onclick = () => {
        if (state[q.id]) return;

        const selected = q.inputs.find(
          (input) => input.checked
        );

        if (!selected) {
          if (warning) {
            warning.hidden = false;
          } else {
            alert('Selecione uma alternativa antes de conferir.');
          }

          return;
        }

        if (warning) warning.hidden = true;

        const chosen = letra(selected.value);

        state[q.id] = {
          chosen,
          isCorrect: chosen === q.correta,
          timestamp: new Date().toISOString()
        };

        salvar();
        mostrarResposta(q, chosen);
        placar();
      };
    }

    reset.onclick = () => {
      const confirmado = confirm(
        'Deseja refazer as questões deste módulo? ' +
        'O progresso local deste módulo será reiniciado.'
      );

      if (!confirmado) return;

      state = Object.create(null);

      // Substitui o progresso anterior por um estado vazio.
      salvar();

      for (const q of questoes) {
        q.inputs.forEach((input) => {
          input.checked = false;
          input.disabled = false;
        });

        q.block
          .querySelectorAll('.option-label')
          .forEach((el) => {
            el.classList.remove('is-correct', 'is-wrong');
          });

        q.block
          .querySelectorAll('.answer-indicator')
          .forEach((el) => el.remove());

        const button = q.block.querySelector(
          '.btn-check-answer'
        );

        if (button) {
          button.disabled = false;
          button.textContent = 'Conferir resposta';
        }

        const feedback = q.block.querySelector(
          '.question-feedback'
        );

        if (feedback) feedback.hidden = true;

        const warning = q.block.querySelector(
          '.selection-warning'
        );

        if (warning) warning.hidden = true;
      }

      placar();
    };

    placar();
  }

  // 4. Questões em arrays
  // Aceita alternativas com ou sem a propriedade "letra".

  window.initObrasQuiz = async function (moduleId, questions) {
    if (!(await inicializarAutenticacao())) return;

    const target =
      document.getElementById(`quiz-container-${moduleId}`) ||
      Array.from(
        document.querySelectorAll('[data-quiz-module]')
      ).find(
        (el) =>
          el.getAttribute('data-quiz-module') === moduleId
      );

    if (
      !target ||
      !Array.isArray(questions) ||
      inicializados.has(target)
    ) {
      return;
    }

    let lista;

    try {
      lista = normalizarQuestoes(questions);
    } catch (_) {
      target.textContent =
        'Não foi possível carregar as questões. Confira os dados deste módulo.';

      return;
    }

    // Os campos de conteúdo aceitam a marcação HTML
    // dos materiais autorais cadastrados nas páginas.
    target.innerHTML = lista.map((q, indice) => `
      <article
        class="question-block"
        data-question-id="${escapar(q.id)}"
        data-correct-answer="${escapar(q.gabarito)}"
      >
        <div class="question-meta-tags">
          <span class="tag">Questão ${indice + 1}</span>

          <span class="tag">
            ${escapar(q.referencia || '')}
          </span>

          <span class="tag">
            Habilidade: ${escapar(q.habilidade || '')}
          </span>

          ${
            q.temaRevisao
              ? `
                <span class="tag">
                  Revisão: ${escapar(q.temaRevisao)}
                </span>
              `
              : ''
          }
        </div>

        <p
          class="question-text"
          id="${escapar(moduleId)}-pergunta-${indice}"
        >
          ${q.enunciado || ''}
        </p>

        <div
          class="options-group"
          role="radiogroup"
          aria-labelledby="${escapar(moduleId)}-pergunta-${indice}"
        >
          ${q.alternativas.map((alt) => `
            <label class="option-label">
              <input
                type="radio"
                name="q_${escapar(q.id)}"
                value="${escapar(alt.letra)}"
              >

              <span>
                <strong>${escapar(alt.letra)})</strong>
                ${alt.texto || ''}
              </span>
            </label>
          `).join('')}
        </div>

        <button
          type="button"
          class="btn btn-check-answer"
        >
          Conferir resposta
        </button>

        <div
          class="selection-warning"
          role="status"
          hidden
        >
          Selecione uma alternativa antes de conferir.
        </div>

        <div
          class="question-feedback"
          aria-live="polite"
          hidden
        >
          <div class="feedback-status correct">
            Gabarito: ${escapar(q.gabarito)}
          </div>

          <div class="feedback-body">
            <h4>Análise da alternativa correta</h4>

            <p>${q.explicacaoGabarito || ''}</p>

            <div class="feedback-distractors">
              <h4>
                Por que as outras alternativas estão incorretas?
              </h4>

              <ul>
                ${
                  q.alternativas
                    .filter(
                      (alt) => alt.letra !== q.gabarito
                    )
                    .map((alt) => `
                      <li>
                        <strong>${escapar(alt.letra)}:</strong>
                        ${alt.explicacaoErro || ''}
                      </li>
                    `)
                    .join('')
                }
              </ul>
            </div>
          </div>
        </div>
      </article>
    `).join('');

    inicializarQuizParaContainer(target, moduleId);
  };

  // 5. Critérios de redação
  // Compatibilidade com os dois modelos de HTML.

  window.toggleObrasCriteria = function (button, targetId) {
    const autorizado =
      document.documentElement.getAttribute(
        'data-obras-access'
      ) === 'granted';

    if (!autorizado) return;

    const drawer = document.getElementById(targetId);

    if (!drawer || !button) return;

    drawer.hidden = !drawer.hidden;

    button.setAttribute('aria-controls', targetId);
    button.setAttribute(
      'aria-expanded',
      String(!drawer.hidden)
    );

    button.textContent = drawer.hidden
      ? 'Ver resposta-modelo e critérios de autoavaliação'
      : 'Ocultar resposta-modelo e critérios';
  };

  function prepararDrawers() {
    document
      .querySelectorAll(
        '.criteria-drawer, .obras-criteria-box'
      )
      .forEach((el) => {
        el.hidden = true;
      });

    document
      .querySelectorAll(
        '.btn-toggle-criteria, button[aria-controls]'
      )
      .forEach((btn) => {
        const targetId =
          btn.getAttribute('data-target') ||
          btn.getAttribute('aria-controls');

        const drawer =
          targetId && document.getElementById(targetId);

        if (
          !drawer ||
          !drawer.matches(
            '.criteria-drawer, .obras-criteria-box'
          )
        ) {
          return;
        }

        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', targetId);

        btn.onclick = () => {
          window.toggleObrasCriteria(btn, targetId);
        };
      });
  }

  // 6. Inicialização

  async function iniciarObras() {
    prepararDrawers();

    if (!(await inicializarAutenticacao())) return;

    document
      .querySelectorAll('[data-quiz-module]')
      .forEach((container) => {
        inicializarQuizParaContainer(
          container,
          container.getAttribute('data-quiz-module')
        );
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      iniciarObras,
      { once: true }
    );
  } else {
    iniciarObras();
  }
})();
