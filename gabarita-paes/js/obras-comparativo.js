/**
 * Gabarita PAES - Módulo Comparativo: As Três Obras (PAES UEMA 2027)
 * Script dedicado para controle de progresso, conferência das 6 questões e autoavaliação
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
      console.warn('Erro ao ler dados do usuário:', e);
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

  // 2. Motor das 6 Questões Comparativas
  function inicializarQuizComparativo() {
    const container = document.querySelector('[data-quiz-module="comparativo"]') || document.getElementById('questoes-comparativas');
    if (!container) return;

    const userId = getUserId();
    const storageKey = `gabarita_obras_${userId}_comparativo`;

    const questionBlocks = container.querySelectorAll('.question-block');
    const totalQuestions = questionBlocks.length;
    const scoreBadge = document.getElementById('quiz-score-badge');
    const resetBtn = document.getElementById('btn-reset-quiz');

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
      const radioInputs = block.querySelectorAll('input[type="radio"]');
      const checkBtn = block.querySelector('.btn-check-answer');
      const feedbackBox = block.querySelector('.question-feedback');
      const warningEl = block.querySelector('.selection-warning');

      // Se já estava gravada
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

      // Evento de clique para conferir
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

          // Travar rádios
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

    // Botão de refazer
    if (resetBtn) {
      resetBtn.onclick = function () {
        if (!confirm('Deseja refazer todas as 6 questões comparativas? O progresso do módulo será reiniciado.')) {
          return;
        }

        try {
          localStorage.removeItem(storageKey);
        } catch (e) {}
        savedState = {};

        questionBlocks.forEach((block) => {
          const radioInputs = block.querySelectorAll('input[type="radio"]');
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

  document.addEventListener('DOMContentLoaded', () => {
    inicializarAutenticacao();
    inicializarQuizComparativo();
  });
})();