/**
 * Gabarita PAES — Obras Obrigatórias
 * Autorização pelo backend, exercícios e autoavaliação.
 */
(function () {
  'use strict';

  let obrasUserId = null;
  let obrasAccessPromise = null;

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

  // 2. Motor de questões
  function inicializarQuizParaContainer(quizContainer, moduleId) {
    if (!quizContainer) return;

    const userId = getUserId();
    const storageKey = `gabarita_obras_${userId}_${moduleId}`;

    const questionBlocks =
      quizContainer.querySelectorAll('.question-block');

    const totalQuestions = questionBlocks.length;

    const scoreBadge =
      document.getElementById('quiz-score-badge') ||
      document.getElementById(`quiz-stats-${moduleId}`);

    const resetBtn =
      document.getElementById('btn-reset-quiz') ||
      document.getElementById(`btn-reset-${moduleId}`);

    let savedState = {};

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) savedState = JSON.parse(raw);
    } catch (_) {
      savedState = {};
    }

    function atualizarPlacar() {
      if (!scoreBadge) return;

      const respondidas = Object.keys(savedState).length;
      let acertos = 0;

      for (const qId in savedState) {
        if (savedState[qId].isCorrect) acertos++;
      }

      scoreBadge.innerHTML =
        `<strong>${respondidas} de ${totalQuestions} respondidas | ` +
        `${acertos} acerto(s)</strong>`;
    }

    function destacarOpcoes(block, chosenVal, correctVal) {
      const labels = block.querySelectorAll('.option-label');

      labels.forEach((lbl) => {
        const radio = lbl.querySelector('input[type="radio"]');
        if (!radio) return;

        const val = radio.value;

        lbl.classList.remove('is-correct', 'is-wrong');

        if (val === correctVal) {
          lbl.classList.add('is-correct');

          if (!lbl.querySelector('.answer-indicator')) {
            const ind = document.createElement('span');

            ind.className = 'answer-indicator';
            ind.style.marginLeft = 'auto';
            ind.style.fontWeight = '700';
            ind.style.color = '#059669';
            ind.textContent = ' [✓ Gabarito]';

            lbl.appendChild(ind);
          }
        }

        if (val === chosenVal && val !== correctVal) {
          lbl.classList.add('is-wrong');

          if (!lbl.querySelector('.answer-indicator')) {
            const ind = document.createElement('span');

            ind.className = 'answer-indicator';
            ind.style.marginLeft = 'auto';
            ind.style.fontWeight = '700';
            ind.style.color = '#dc2626';
            ind.textContent = ' [✗ Sua escolha]';

            lbl.appendChild(ind);
          }
        }
      });
    }

    questionBlocks.forEach((block) => {
      const qId = block.getAttribute('data-question-id');
      const correctKey = block.getAttribute('data-correct-answer');

      const radioInputs =
        block.querySelectorAll(`input[name="q_${qId}"]`);

      const checkBtn = block.querySelector('.btn-check-answer');
      const feedbackBox = block.querySelector('.question-feedback');
      const warningEl = block.querySelector('.selection-warning');

      if (savedState[qId]) {
        const savedAnswer = savedState[qId].chosen;

        radioInputs.forEach((input) => {
          input.checked = input.value === savedAnswer;
          input.disabled = true;
        });

        if (checkBtn) {
          checkBtn.disabled = true;
          checkBtn.textContent = 'Resposta Registrada';
        }

        destacarOpcoes(block, savedAnswer, correctKey);

        if (feedbackBox) feedbackBox.hidden = false;
      }

      if (checkBtn) {
        checkBtn.onclick = function () {
          let selectedValue = null;

          radioInputs.forEach((radio) => {
            if (radio.checked) selectedValue = radio.value;
          });

          if (!selectedValue) {
            if (warningEl) {
              warningEl.hidden = false;
            } else {
              alert('Por favor, selecione uma alternativa antes de conferir.');
            }

            return;
          }

          if (warningEl) warningEl.hidden = true;

          const isCorrect = selectedValue === correctKey;

          radioInputs.forEach((input) => {
            input.disabled = true;
          });

          checkBtn.disabled = true;
          checkBtn.textContent = 'Resposta Registrada';

          savedState[qId] = {
            chosen: selectedValue,
            isCorrect,
            timestamp: new Date().toISOString()
          };

          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify(savedState)
            );
          } catch (_) {}

          destacarOpcoes(block, selectedValue, correctKey);

          if (feedbackBox) feedbackBox.hidden = false;

          atualizarPlacar();
        };
      }
    });

    if (resetBtn) {
      resetBtn.onclick = function () {
        const confirmado = confirm(
          'Deseja refazer todas as questões deste módulo? ' +
          'Seu histórico local será reiniciado.'
        );

        if (!confirmado) return;

        try {
          localStorage.removeItem(storageKey);
        } catch (_) {}

        savedState = {};

        questionBlocks.forEach((block) => {
          const qId = block.getAttribute('data-question-id');

          const radioInputs =
            block.querySelectorAll(`input[name="q_${qId}"]`);

          const checkBtn = block.querySelector('.btn-check-answer');
          const feedbackBox = block.querySelector('.question-feedback');
          const warningEl = block.querySelector('.selection-warning');
          const labels = block.querySelectorAll('.option-label');

          radioInputs.forEach((input) => {
            input.checked = false;
            input.disabled = false;
          });

          labels.forEach((lbl) => {
            lbl.classList.remove('is-correct', 'is-wrong');

            const ind = lbl.querySelector('.answer-indicator');
            if (ind) ind.remove();
          });

          if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Conferir Resposta';
          }

          if (feedbackBox) feedbackBox.hidden = true;
          if (warningEl) warningEl.hidden = true;
        });

        atualizarPlacar();
      };
    }

    atualizarPlacar();
  }

  // 3. Questões fornecidas pelos módulos em arrays
  window.initObrasQuiz = async function (moduleId, questions) {
    if (!(await inicializarAutenticacao())) return;

    const targetEl =
      document.getElementById(`quiz-container-${moduleId}`) ||
      document.querySelector('[data-quiz-module]');

    if (!targetEl || !Array.isArray(questions)) return;

    let html = '';

    questions.forEach((q, index) => {
      const qNum = index + 1;

      html += `
        <article
          class="question-block"
          data-question-id="${q.id}"
          data-correct-answer="${q.gabarito}"
        >
          <div class="question-meta-tags">
            <span class="tag">Questão ${qNum}</span>
            <span class="tag">${q.referencia || ''}</span>
            <span class="tag">Habilidade: ${q.habilidade || ''}</span>
          </div>

          <p class="question-text">${q.enunciado}</p>

          <div class="options-group">
            ${q.alternativas.map(alt => `
              <label class="option-label">
                <input
                  type="radio"
                  name="q_${q.id}"
                  value="${alt.letra}"
                >
                <span>
                  <strong>${alt.letra})</strong> ${alt.texto}
                </span>
              </label>
            `).join('')}
          </div>

          <button
            type="button"
            class="btn btn-check-answer"
            style="padding: 0.5rem 1rem;"
          >
            Conferir Resposta
          </button>

          <div
            class="selection-warning"
            style="color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem;"
            hidden
          >
            ⚠️ Selecione uma alternativa antes de conferir.
          </div>

          <div class="question-feedback" hidden>
            <div class="feedback-status correct">
              Gabarito: ${q.gabarito}
            </div>

            <div class="feedback-body">
              <h4>Análise da Alternativa Correta</h4>
              <p>${q.explicacaoGabarito}</p>

              <div class="feedback-distractors">
                <h4>Por que os outros distratores estão incorretos?</h4>
                <ul>
                  ${q.alternativas
                    .filter(alt => alt.letra !== q.gabarito)
                    .map(alt => `
                      <li>
                        <strong>${alt.letra}:</strong>
                        ${alt.explicacaoErro}
                      </li>
                    `).join('')}
                </ul>
              </div>
            </div>
          </div>
        </article>
      `;
    });

    targetEl.innerHTML = html;
    inicializarQuizParaContainer(targetEl, moduleId);
  };

  // 4. Questões já presentes no HTML
  function inicializarQuizesEstaticos() {
    const containers =
      document.querySelectorAll('[data-quiz-module]');

    containers.forEach((container) => {
      const moduleId = container.getAttribute('data-quiz-module');
      inicializarQuizParaContainer(container, moduleId);
    });
  }

  // 5. Respostas-modelo e critérios de autoavaliação
  function inicializarDrawersRedacao() {
    const toggleButtons =
      document.querySelectorAll('.btn-toggle-criteria');

    toggleButtons.forEach((btn) => {
      btn.onclick = function () {
        const targetId = btn.getAttribute('data-target');
        const drawer = document.getElementById(targetId);

        if (!drawer) return;

        const isHidden = drawer.hidden;

        drawer.hidden = !isHidden;
        btn.setAttribute('aria-expanded', String(isHidden));

        btn.textContent = isHidden
          ? 'Ocultar Resposta-Modelo e Critérios ▲'
          : 'Ver Resposta-Modelo e Critérios de Autoavaliação ▼';
      };
    });
  }

  // 6. Inicialização após a autorização
  async function iniciarObras() {
    if (!(await inicializarAutenticacao())) return;

    inicializarQuizesEstaticos();
    inicializarDrawersRedacao();
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
