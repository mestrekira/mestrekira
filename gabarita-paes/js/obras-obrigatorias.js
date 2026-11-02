/**
 * Gabarita PAES - Seção Obras Obrigatórias (PAES UEMA 2027)
 * Controle de Autenticação, Interface e Motor Universal de Questões
 */

(function () {
  'use strict';

  // 1. Verificação de Autenticação e Usuário
  function inicializarAutenticacao() {
    if (window.api && typeof window.api.getToken === 'function') {
      const token = window.api.getToken();
      if (!token) {
        window.location.href = 'login.html';
        return;
      }
    }

    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user && user.name) {
          const userEl = document.getElementById('user-name');
          if (userEl) {
            userEl.innerText = `👤 ${user.name.split(' ')[0]}`;
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao processar dados de usuário do localStorage:', e);
    }
  }

  function getUserId() {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id || user.email || 'anonimo';
      }
    } catch (e) {}
    return 'padrao';
  }

  // 2. Motor de Questões para Elementos no DOM
  function inicializarQuizParaContainer(quizContainer, moduleId) {
    if (!quizContainer) return;

    const userId = getUserId();
    const storageKey = `gabarita_obras_${userId}_${moduleId}`;

    const questionBlocks = quizContainer.querySelectorAll('.question-block');
    const totalQuestions = questionBlocks.length;
    const scoreBadge = document.getElementById('quiz-score-badge') || document.getElementById(`quiz-stats-${moduleId}`);
    const resetBtn = document.getElementById('btn-reset-quiz') || document.getElementById(`btn-reset-${moduleId}`);

    let savedState = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) savedState = JSON.parse(raw);
    } catch (e) {
      savedState = {};
    }

    function atualizarPlacar() {
      if (!scoreBadge) return;
      const respondidas = Object.keys(savedState).length;
      let acertos = 0;
      for (const qId in savedState) {
        if (savedState[qId].isCorrect) acertos++;
      }
      scoreBadge.innerHTML = `<strong>${respondidas} de ${totalQuestions} respondidas | ${acertos} acerto(s)</strong>`;
    }

    questionBlocks.forEach((block) => {
      const qId = block.getAttribute('data-question-id');
      const correctKey = block.getAttribute('data-correct-answer');
      const radioInputs = block.querySelectorAll(`input[name="q_${qId}"]`);
      const checkBtn = block.querySelector('.btn-check-answer');
      const feedbackBox = block.querySelector('.question-feedback');
      const warningEl = block.querySelector('.selection-warning');

      if (savedState[qId]) {
        const savedAnswer = savedState[qId].chosen;
        radioInputs.forEach((input) => {
          if (input.value === savedAnswer) {
            input.checked = true;
          }
          input.disabled = true;
        });

        if (checkBtn) {
          checkBtn.disabled = true;
          checkBtn.innerText = 'Resposta Registrada';
        }

        destacarOpcoes(block, savedAnswer, correctKey);
        if (feedbackBox) {
          feedbackBox.hidden = false;
        }
      }

      if (checkBtn) {
        checkBtn.onclick = function () {
          let selectedValue = null;
          radioInputs.forEach((r) => {
            if (r.checked) selectedValue = r.value;
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
          checkBtn.innerText = 'Resposta Registrada';

          savedState[qId] = {
            chosen: selectedValue,
            isCorrect: isCorrect,
            timestamp: new Date().toISOString()
          };

          try {
            localStorage.setItem(storageKey, JSON.stringify(savedState));
          } catch (e) {}

          destacarOpcoes(block, selectedValue, correctKey);
          if (feedbackBox) {
            feedbackBox.hidden = false;
          }

          atualizarPlacar();
        };
      }
    });

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
            ind.innerText = ' [✓ Gabarito]';
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
            ind.innerText = ' [✗ Sua escolha]';
            lbl.appendChild(ind);
          }
        }
      });
    }

    if (resetBtn) {
      resetBtn.onclick = function () {
        if (!confirm('Deseja refazer todas as questões deste módulo? Seu histórico local será reiniciado.')) {
          return;
        }

        try {
          localStorage.removeItem(storageKey);
        } catch (e) {}
        savedState = {};

        questionBlocks.forEach((block) => {
          const qId = block.getAttribute('data-question-id');
          const radioInputs = block.querySelectorAll(`input[name="q_${qId}"]`);
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
            checkBtn.innerText = 'Conferir Resposta';
          }

          if (feedbackBox) {
            feedbackBox.hidden = true;
          }

          if (warningEl) {
            warningEl.hidden = true;
          }
        });

        atualizarPlacar();
      };
    }

    atualizarPlacar();
  }

  // 3. API Dinâmica: window.initObrasQuiz (para módulos que passam dados em array)
  window.initObrasQuiz = function (moduleId, questions) {
    const targetEl = document.getElementById(`quiz-container-${moduleId}`) || document.querySelector('[data-quiz-module]');
    if (!targetEl || !Array.isArray(questions)) return;

    let html = '';
    questions.forEach((q, index) => {
      const qNum = index + 1;
      html += `
        <article class="question-block" data-question-id="${q.id}" data-correct-answer="${q.gabarito}">
          <div class="question-meta-tags">
            <span class="tag">Questão ${qNum}</span>
            <span class="tag">${q.referencia || ''}</span>
            <span class="tag">Habilidade: ${q.habilidade || ''}</span>
          </div>
          <p class="question-text">${q.enunciado}</p>
          <div class="options-group">
            ${q.alternativas.map(alt => `
              <label class="option-label">
                <input type="radio" name="q_${q.id}" value="${alt.letra}">
                <span><strong>${alt.letra})</strong> ${alt.texto}</span>
              </label>
            `).join('')}
          </div>
          <button type="button" class="btn btn-check-answer" style="padding: 0.5rem 1rem;">Conferir Resposta</button>
          <div class="selection-warning" style="color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem;" hidden>⚠️ Selecione uma alternativa antes de conferir.</div>

          <div class="question-feedback" hidden>
            <div class="feedback-status correct">Gabarito: ${q.gabarito}</div>
            <div class="feedback-body">
              <h4>Análise da Alternativa Correta</h4>
              <p>${q.explicacaoGabarito}</p>
              <div class="feedback-distractors">
                <h4>Por que os outros distratores estão incorretos?</h4>
                <ul>
                  ${q.alternativas.filter(alt => alt.letra !== q.gabarito).map(alt => `
                    <li><strong>${alt.letra}:</strong> ${alt.explicacaoErro}</li>
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

  // 4. Inicialização de Módulos Estáticos
  function inicializarQuizesEstaticos() {
    const staticContainers = document.querySelectorAll('[data-quiz-module]');
    staticContainers.forEach((container) => {
      const moduleId = container.getAttribute('data-quiz-module');
      inicializarQuizParaContainer(container, moduleId);
    });
  }

  // 5. Critérios de Redação com Autoavaliação (Drawer Toggle)
  function inicializarDrawersRedacao() {
    const toggleButtons = document.querySelectorAll('.btn-toggle-criteria');
    toggleButtons.forEach((btn) => {
      btn.onclick = function () {
        const targetId = btn.getAttribute('data-target');
        const drawer = document.getElementById(targetId);
        if (!drawer) return;

        const isHidden = drawer.hidden;
        drawer.hidden = !isHidden;
        btn.setAttribute('aria-expanded', String(isHidden));
        btn.innerText = isHidden
          ? 'Ocultar Resposta-Modelo e Critérios ▲'
          : 'Ver Resposta-Modelo e Critérios de Autoavaliação ▼';
      };
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    inicializarAutenticacao();
    inicializarQuizesEstaticos();
    inicializarDrawersRedacao();
  });
})();
