/**
 * Obras Obrigatórias - PAES UEMA 2027
 * Gerenciamento de estado, acessibilidade e interatividade pedagógica
 * Isolado no navegador (localStorage) sem impacto em notas de simulados ou backend
 */

(function () {
  'use strict';

  function getCurrentUserId() {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id || user.email || (user.name ? user.name.trim().toLowerCase().replace(/\s+/g, '_') : 'aluno_padrao');
      }
    } catch (e) {
      console.warn('Erro ao acessar dados de usuário no localStorage:', e);
    }
    return 'aluno_padrao';
  }

  function getStorageKey(moduleId) {
    return `gabarita_obras_${getCurrentUserId()}_${moduleId}`;
  }

  function loadModuleProgress(moduleId) {
    try {
      const saved = localStorage.getItem(getStorageKey(moduleId));
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Falha ao ler progresso do módulo:', e);
    }
    return { answeredCount: 0, correctCount: 0, answers: {} };
  }

  function saveModuleProgress(moduleId, progressData) {
    try {
      localStorage.setItem(getStorageKey(moduleId), JSON.stringify(progressData));
    } catch (e) {
      console.error('Falha ao salvar progresso no localStorage:', e);
    }
  }

  window.initObrasPage = function () {
    if (window.api && typeof window.api.getToken === 'function') {
      if (!window.api.getToken()) {
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
          if (userEl) userEl.innerText = `👤 ${user.name.split(' ')[0]}`;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar nome do usuário:', e);
    }
  };

  window.initObrasQuiz = function (moduleId, questionsList) {
    const container = document.getElementById(`quiz-container-${moduleId}`);
    const statsContainer = document.getElementById(`quiz-stats-${moduleId}`);
    if (!container) return;

    let progress = loadModuleProgress(moduleId);

    function updateStatsDisplay() {
      if (!statsContainer) return;
      const total = questionsList.length;
      const answered = Object.keys(progress.answers).length;
      const correct = Object.values(progress.answers).filter(a => a.isCorrect).length;
      const percent = answered > 0 ? Math.round((correct / answered) * 100) : 0;

      statsContainer.innerHTML = `
        <div class="obras-quiz-header" role="region" aria-label="Resumo do seu progresso">
          <div class="obras-quiz-status">
            <div class="obras-quiz-stat-item">
              <span class="obras-quiz-stat-label">Respondidas</span>
              <span class="obras-quiz-stat-val">${answered} de ${total}</span>
            </div>
            <div class="obras-quiz-stat-item">
              <span class="obras-quiz-stat-label">Acertos</span>
              <span class="obras-quiz-stat-val">${correct} (${percent}%)</span>
            </div>
          </div>
          <div>
            <button type="button" class="btn btn-secondary" id="btn-reset-${moduleId}" style="padding: 0.4rem 0.9rem; font-size: 0.85rem;" aria-label="Reiniciar respostas deste módulo">
              🔄 Refazer questões
            </button>
          </div>
        </div>
      `;

      const resetBtn = document.getElementById(`btn-reset-${moduleId}`);
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          if (confirm('Deseja reiniciar suas tentativas neste módulo? Suas marcações atuais serão limpas para novo treino.')) {
            progress = { answeredCount: 0, correctCount: 0, answers: {} };
            saveModuleProgress(moduleId, progress);
            renderAllQuestions();
          }
        });
      }
    }

    function renderQuestion(q, index) {
      const qId = q.id;
      const savedAns = progress.answers[qId];
      const isAnswered = !!savedAns;

      const qCard = document.createElement('article');
      qCard.className = 'obras-question-card';
      qCard.id = `q-card-${qId}`;

      let html = `
        <div class="obras-q-meta">
          <span class="obras-q-number" id="q-title-${qId}">Questão ${index + 1} de ${questionsList.length}</span>
          <span class="obras-q-skill">Habilidade: ${q.habilidade}</span>
        </div>
        <div class="obras-q-ref">
          <strong>Referência textual:</strong> ${q.referencia}
        </div>
        <div class="obras-q-statement">
          ${q.enunciado}
        </div>
        <fieldset class="obras-options-list">
          <legend class="sr-only">Alternativas da Questão ${index + 1}</legend>
      `;

      const letters = ['A', 'B', 'C', 'D', 'E'];
      q.alternativas.forEach((alt, idx) => {
        const letter = letters[idx];
        const isSelected = isAnswered && savedAns.selected === letter;
        const isCorrectChoice = isAnswered && letter === q.gabarito;
        const isWrongChoice = isAnswered && isSelected && !isCorrectChoice;

        let labelClass = 'obras-option-label';
        let statusBadge = '';

        if (isAnswered) {
          if (isCorrectChoice) {
            labelClass += ' is-correct';
            statusBadge = '<span class="obras-status-badge correct">✔ Correto</span>';
          } else if (isWrongChoice) {
            labelClass += ' is-incorrect';
            statusBadge = '<span class="obras-status-badge incorrect">✖ Incorreto</span>';
          }
        }

        html += `
          <label class="${labelClass}">
            <input type="radio" name="opt-${qId}" value="${letter}" ${isSelected ? 'checked' : ''} ${isAnswered ? 'disabled' : ''}>
            <span class="obras-option-text">
              <strong class="obras-option-letter">(${letter})</strong> ${alt.texto}
            </span>
            ${statusBadge}
          </label>
        `;
      });

      html += `</fieldset>`;

      if (!isAnswered) {
        html += `
          <div style="margin-top: 1.25rem;">
            <button type="button" class="btn" id="btn-check-${qId}" style="padding: 0.55rem 1.25rem;">
              Conferir resposta
            </button>
            <span id="msg-warn-${qId}" style="margin-left: 0.75rem; color: #b91c1c; font-size: 0.88rem; display: none;" role="alert">
              ⚠️ Selecione uma alternativa antes de conferir.
            </span>
          </div>
        `;
      }

      html += `
        <div class="obras-commentary-box ${isAnswered ? 'is-visible' : ''}" id="comm-${qId}">
          <h5 class="obras-commentary-title">Justificativa e Análise Pedagógica</h5>
          <div class="obras-correct-reason">
            <strong>Gabarito Oficial: Alternativa (${q.gabarito})</strong><br>
            ${q.explicacaoGabarito}
          </div>
          <div class="obras-distractors-list">
            <strong>Por que as outras alternativas estão incorretas:</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0;">
      `;

      letters.forEach((l, i) => {
        if (l !== q.gabarito && q.alternativas[i]) {
          html += `<li class="obras-distractor-item"><strong>(${l}):</strong> ${q.alternativas[i].explicacaoErro}</li>`;
        }
      });

      html += `
            </ul>
          </div>
          <div style="margin-top: 0.85rem; font-size: 0.82rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 0.5rem;">
            <strong>Tema de revisão:</strong> ${q.temaRevisao} · <em>Questão autoral de preparação para o PAES UEMA 2027.</em>
          </div>
        </div>
      `;

      qCard.innerHTML = html;

      if (!isAnswered) {
        const checkBtn = qCard.querySelector(`#btn-check-${qId}`);
        const warnMsg = qCard.querySelector(`#msg-warn-${qId}`);

        checkBtn.addEventListener('click', () => {
          const selectedRadio = qCard.querySelector(`input[name="opt-${qId}"]:checked`);
          if (!selectedRadio) {
            warnMsg.style.display = 'inline';
            return;
          }
          warnMsg.style.display = 'none';

          const chosenLetter = selectedRadio.value;
          progress.answers[qId] = {
            selected: chosenLetter,
            isCorrect: chosenLetter === q.gabarito
          };
          saveModuleProgress(moduleId, progress);

          const updatedCard = renderQuestion(q, index);
          qCard.replaceWith(updatedCard);
          updateStatsDisplay();

          const comm = document.getElementById(`comm-${qId}`);
          if (comm) {
            comm.setAttribute('tabindex', '-1');
            comm.focus();
          }
        });
      }

      return qCard;
    }

    function renderAllQuestions() {
      container.innerHTML = '';
      updateStatsDisplay();
      questionsList.forEach((q, idx) => {
        container.appendChild(renderQuestion(q, idx));
      });
    }

    renderAllQuestions();
  };

  window.toggleObrasCriteria = function (btnElement, contentId) {
    const box = document.getElementById(contentId);
    if (!box) return;
    const isOpen = box.classList.contains('is-open');
    if (isOpen) {
      box.classList.remove('is-open');
      btnElement.setAttribute('aria-expanded', 'false');
      btnElement.innerText = 'Ver resposta esperada e critérios';
    } else {
      box.classList.add('is-open');
      btnElement.setAttribute('aria-expanded', 'true');
      btnElement.innerText = 'Ocultar critérios de avaliação';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.initObrasPage();
  });
})();
