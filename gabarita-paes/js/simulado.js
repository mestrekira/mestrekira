let currentSimulationId = null;
let allOfficialQuestions = []; // Guarda todas as 60 questões na memória
let activeDiscipline = '';

let allWrongQuestions = []; // Guarda todas as questões erradas
let activeReviewDiscipline = '';
let currentMode = 'oficial'; // 'oficial' ou 'revisao'

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api || !window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  // 1. Exibe o nome do estudante no menu do topo
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.name) {
        const userEl = document.getElementById('user-name');
        if (userEl) userEl.innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (e) {
    console.error(e);
  }

  // 2. Configura os cliques dos botões de filtro
  setupFilterButtons();
  setupReviewFilters();

  // 3. Carrega o simulado
  loadSimulation();
});

// ==========================================
// 1. Alternância entre Oficial e Revisão
// ==========================================
window.alternarModo = (modo) => {
  currentMode = modo;
  const tabOfficial = document.getElementById('tab-official');
  const tabReview = document.getElementById('tab-review');
  const secOfficial = document.getElementById('section-official');
  const secReview = document.getElementById('section-review');

  if (modo === 'oficial') {
    if (tabOfficial) tabOfficial.classList.add('active');
    if (tabReview) tabReview.classList.remove('active');
    if (secOfficial) secOfficial.style.display = 'block';
    if (secReview) secReview.style.display = 'none';
    renderQuestions();
  } else {
    if (tabOfficial) tabOfficial.classList.remove('active');
    if (tabReview) tabReview.classList.add('active');
    if (secOfficial) secOfficial.style.display = 'none';
    if (secReview) secReview.style.display = 'block';
    loadErrorReview();
  }
};

// ==========================================
// 2. Caderno Oficial (60 Questões)
// ==========================================
async function loadSimulation() {
  const container = document.getElementById('questions-container');
  try {
    const data = await window.api.get('/simulations/current');
    if (!data) return;

    currentSimulationId = data.simulationId;
    allOfficialQuestions = data.questions || [];

    // Atualiza título e barras de progresso
    const cycleTitle = document.getElementById('cycle-title');
    if (cycleTitle) cycleTitle.innerText = data.title;

    atualizarProgresso(data.answeredCount, data.totalQuestions);
    renderQuestions();
  } catch (error) {
    if (container) {
      container.innerHTML = `
        <div class="card" style="color: var(--danger); text-align: center;">
          ${error.message || 'Erro ao carregar o simulado.'}
        </div>
      `;
    }
  }
}

function atualizarProgresso(answered, total) {
  const progressText = document.getElementById('progress-text');
  const progressBar = document.getElementById('progress-bar');
  const finishCard = document.getElementById('finish-card');

  const acertos = allOfficialQuestions.filter((q) => q.isAnswered && q.isCorrect === true).length;
  const erros = allOfficialQuestions.filter((q) => q.isAnswered && q.isCorrect === false).length;

  if (progressText) {
    progressText.innerText = `${answered} de ${total} respondidas (${acertos} acertos • ${erros} erros)`;
  }
  if (progressBar) {
    const percentage = total > 0 ? (answered / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
  }

  // Exibe o card de conclusão se atingiu as 60 questões
  if (finishCard) {
    if (answered >= 60 && total > 0) {
      finishCard.style.display = 'block';
    } else {
      finishCard.style.display = 'none';
    }
  }
}

// Renderiza as questões com filtro instantâneo em memória
function renderQuestions() {
  const container = document.getElementById('questions-container');
  if (!container) return;

  const filtered = activeDiscipline
    ? allOfficialQuestions.filter(
        (q) => q.discipline.trim().toLowerCase() === activeDiscipline.trim().toLowerCase(),
      )
    : allOfficialQuestions;

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        Nenhuma questão encontrada para a matéria <strong>${activeDiscipline}</strong>.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (q) => `
    <div class="card" id="card-${q.questionId}">
      <div class="question-header">
        <span class="badge">Questão ${q.questionOrder} • ${q.discipline}</span>
        <span style="color: var(--text-muted); font-size: 0.85rem;">${q.topic}</span>
      </div>

      <div class="question-statement">${q.statement.replace(/\n/g, '<br>')}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Figura">` : ''}
      ${q.imageUrlB ? `<img src="${q.imageUrlB}" class="question-img" alt="Figura complementar">` : ''}

      <div class="options-list" id="opts-${q.questionId}">
        ${[...q.options]
          .sort((a, b) => a.letter.localeCompare(b.letter))
          .map(
            (opt) => `
          <div class="option-item ${q.selectedOptionId === opt.id ? 'selected' : ''}" 
               onclick="selectOption('${q.questionId}', '${opt.id}')"
               id="opt-${opt.id}">
            <span class="option-letter">${opt.letter}</span>
            <span class="option-text">${opt.text}</span>
          </div>
        `,
          )
          .join('')}
      </div>

      <button class="btn" id="btn-submit-${q.questionId}" 
              onclick="submitAnswer('${q.questionId}')" 
              ${q.isAnswered ? 'disabled style="background: var(--text-muted); cursor: not-allowed;"' : ''}>
        ${q.isAnswered ? '✓ Resposta Gravada' : 'Confirmar Resposta'}
      </button>
    </div>
  `,
    )
    .join('');
}

// ==========================================
// 3. Seleção, Gravação e Finalização
// ==========================================
window.tempSelections = {};
window.selectOption = (questionId, optionId) => {
  const optsContainer = document.getElementById(`opts-${questionId}`);
  if (!optsContainer) return;
  optsContainer.querySelectorAll('.option-item').forEach((el) => el.classList.remove('selected'));
  const targetOpt = document.getElementById(`opt-${optionId}`);
  if (targetOpt) targetOpt.classList.add('selected');
  window.tempSelections[questionId] = optionId;
};

window.submitAnswer = async (questionId) => {
  const selectedOptionId = window.tempSelections[questionId];
  if (!selectedOptionId) {
    alert('Por favor, selecione uma alternativa antes de confirmar.');
    return;
  }

  const btn = document.getElementById(`btn-submit-${questionId}`);
  if (btn) {
    btn.innerText = 'Gravando...';
    btn.disabled = true;
  }

  try {
    const res = await window.api.post('/simulations/answer', {
      simulationId: currentSimulationId,
      questionId,
      selectedOptionId,
    });

    if (btn) {
      btn.innerText = '✓ Resposta Gravada';
      btn.style.background = 'var(--text-muted)';
      btn.style.cursor = 'not-allowed';
    }

    // Atualiza na memória
    const q = allOfficialQuestions.find((item) => item.questionId === questionId);
    if (q) {
      q.isAnswered = true;
      q.selectedOptionId = selectedOptionId;
      q.isCorrect = res.isCorrect;
    }

    const answeredCount = allOfficialQuestions.filter((item) => item.isAnswered).length;
    atualizarProgresso(answeredCount, allOfficialQuestions.length);

    // Se completou a 60ª questão, rola suavemente até o card de conclusão
    if (answeredCount >= 60) {
      const finishCard = document.getElementById('finish-card');
      if (finishCard) finishCard.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    alert(error.message || 'Falha ao gravar resposta.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Confirmar Resposta';
    }
  }
};

// Como o backend grava em tempo real, finalizar é apenas redirecionar para a classificação
window.finalizarSimulado = () => {
  const answeredCount = allOfficialQuestions.filter((item) => item.isAnswered).length;
  if (answeredCount < 60) {
    if (!confirm(`Você respondeu ${answeredCount} de 60 questões. Deseja ver a classificação mesmo assim?`)) {
      return;
    }
  }
  window.location.href = 'ranking.html';
};

// ==========================================
// 4. Revisão Cega (Active Recall)
// ==========================================
async function loadErrorReview() {
  const container = document.getElementById('review-container');
  const counterBadge = document.getElementById('review-counter-badge');

  if (!currentSimulationId) {
    if (container) container.innerHTML = `<div class="card" style="text-align: center;">Inicie o simulado oficial antes de revisar.</div>`;
    return;
  }

  if (container) {
    container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">Buscando suas questões erradas...</div>`;
  }

  try {
    const wrongList = await window.api.get(`/simulations/review-errors?simulationId=${currentSimulationId}`);
    allWrongQuestions = wrongList || [];

    const totalErros = allWrongQuestions.length;
    if (counterBadge) {
      counterBadge.innerText = `${totalErros} ${totalErros === 1 ? 'questão errada' : 'questões erradas'}`;
    }

    renderFilteredReview();
  } catch (err) {
    if (container) {
      container.innerHTML = `<div class="card" style="color: var(--danger); text-align: center;">${err.message || 'Erro ao carregar revisão.'}</div>`;
    }
  }
}

function renderFilteredReview() {
  const container = document.getElementById('review-container');
  if (!container) return;

  const filtered = activeReviewDiscipline
    ? allWrongQuestions.filter(
        (q) => q.discipline.trim().toLowerCase() === activeReviewDiscipline.trim().toLowerCase(),
      )
    : allWrongQuestions;

  if (allWrongQuestions.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem;">
        <h3 style="color: var(--accent);">🎉 Nenhuma questão para revisar!</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Você não errou nenhuma das questões que respondeu até agora.</p>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 2rem;">
        <p style="color: var(--text-muted);">Você não tem erros pendentes na matéria <strong>${activeReviewDiscipline}</strong>! Parabéns!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (q) => `
    <div class="card" id="rev-card-${q.questionId}">
      <div class="question-header">
        <span class="badge" style="background: #fee2e2; color: #991b1b;">Revisar • ${q.discipline}</span>
        <span style="color: #92400e; font-size: 0.85rem;">Segunda Tentativa (Sem Spoiler)</span>
      </div>

      <div class="question-statement">${q.statement.replace(/\n/g, '<br>')}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Figura">` : ''}
      ${q.imageUrlB ? `<img src="${q.imageUrlB}" class="question-img" alt="Figura complementar">` : ''}

      <div class="options-list" id="rev-opts-${q.questionId}">
        ${[...q.options]
          .sort((a, b) => a.letter.localeCompare(b.letter))
          .map(
            (opt) => `
          <div class="option-item" onclick="selectReviewOption('${q.questionId}', '${opt.id}')" id="rev-opt-${opt.id}">
            <span class="option-letter">${opt.letter}</span>
            <span class="option-text">${opt.text}</span>
          </div>
        `,
          )
          .join('')}
      </div>

      <button class="btn" id="btn-rev-${q.questionId}" onclick="submitReviewAnswer('${q.questionId}')">
        Testar Segunda Resposta
      </button>

      <div id="rev-feedback-${q.questionId}" style="display: none; margin-top: 1rem;"></div>
    </div>
  `,
    )
    .join('');
}

window.revSelections = {};
window.selectReviewOption = (questionId, optionId) => {
  const optsContainer = document.getElementById(`rev-opts-${questionId}`);
  if (!optsContainer) return;
  optsContainer.querySelectorAll('.option-item').forEach((el) => el.classList.remove('selected'));
  const targetOpt = document.getElementById(`rev-opt-${optionId}`);
  if (targetOpt) targetOpt.classList.add('selected');
  window.revSelections[questionId] = optionId;
};

window.submitReviewAnswer = async (questionId) => {
  const selectedOptionId = window.revSelections[questionId];
  if (!selectedOptionId) {
    alert('Selecione uma alternativa para testar.');
    return;
  }

  const btn = document.getElementById(`btn-rev-${questionId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Verificando...';
  }

  try {
    const res = await window.api.post('/simulations/answer', {
      simulationId: currentSimulationId,
      questionId,
      selectedOptionId,
    });

    if (btn) btn.style.display = 'none';
    const feedbackBox = document.getElementById(`rev-feedback-${questionId}`);
    if (feedbackBox) {
      feedbackBox.style.display = 'block';

      if (res.isCorrect) {
        feedbackBox.innerHTML = `
          <div style="padding: 1rem; border-radius: 6px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
            <strong>🎯 Excelente! Você encontrou a alternativa correta na revisão!</strong>
          </div>
        `;
      } else {
        feedbackBox.innerHTML = `
          <div style="padding: 1rem; border-radius: 6px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b;">
            <strong>Ainda não é esta alternativa. Continue relendo a questão para encontrar o gabarito.</strong>
          </div>
        `;
        if (btn) {
          btn.style.display = 'inline-flex';
          btn.disabled = false;
          btn.innerText = 'Tentar Outra Alternativa';
        }
      }
    }
  } catch (e) {
    alert(e.message || 'Erro ao verificar revisão.');
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Testar Segunda Resposta';
    }
  }
};

// ==========================================
// 5. Filtros
// ==========================================
function setupFilterButtons() {
  const buttons = document.querySelectorAll('#disciplines-filter .filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiscipline = btn.getAttribute('data-discipline') || '';
      renderQuestions();
    });
  });
}

function setupReviewFilters() {
  const buttons = document.querySelectorAll('#review-disciplines-filter .filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeReviewDiscipline = btn.getAttribute('data-discipline') || '';
      renderFilteredReview();
    });
  });
}
