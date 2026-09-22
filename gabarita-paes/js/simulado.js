let currentSimulationId = null;
let currentQuestions = [];
let activeDiscipline = '';
let currentMode = 'oficial'; // 'oficial' ou 'revisao'

document.addEventListener('DOMContentLoaded', () => {
  if (!window.api.getToken()) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.name) {
        document.getElementById('user-name').innerText = `👤 ${user.name.split(' ')[0]}`;
      }
    }
  } catch (e) {}

  setupFilterButtons();
  loadSimulation();
});

// Alterna entre o Caderno Oficial e a Revisão Cega
window.alternarModo = (modo) => {
  currentMode = modo;
  const tabOfficial = document.getElementById('tab-official');
  const tabReview = document.getElementById('tab-review');
  const secOfficial = document.getElementById('section-official');
  const secReview = document.getElementById('section-review');

  if (modo === 'oficial') {
    tabOfficial.classList.add('active');
    tabReview.classList.remove('active');
    secOfficial.style.display = 'block';
    secReview.style.display = 'none';
    loadSimulation();
  } else {
    tabOfficial.classList.remove('active');
    tabReview.classList.add('active');
    secOfficial.style.display = 'none';
    secReview.style.display = 'block';
    loadErrorReview();
  }
};

// 1. Carrega o Simulado Oficial (60Q)
async function loadSimulation() {
  const container = document.getElementById('questions-container');
  try {
    const url = activeDiscipline
      ? `/simulations/current?discipline=${encodeURIComponent(activeDiscipline)}`
      : '/simulations/current';

    const data = await window.api.get(url);
    if (!data) return;

    currentSimulationId = data.simulationId;
    currentQuestions = data.questions;

    document.getElementById('cycle-title').innerText = data.title;
    document.getElementById('progress-text').innerText = `${data.answeredCount} de ${data.totalQuestions} respondidas`;

    const percentage = (data.answeredCount / data.totalQuestions) * 100;
    document.getElementById('progress-bar').style.width = `${percentage}%`;

    renderQuestions();
  } catch (error) {
    container.innerHTML = `
      <div class="card" style="color: var(--danger); text-align: center;">
        ${error.message || 'Erro ao carregar o simulado.'}
      </div>
    `;
  }
}

function renderQuestions() {
  const container = document.getElementById('questions-container');
  if (!currentQuestions || currentQuestions.length === 0) {
    container.innerHTML = `<div class="card" style="text-align: center;">Nenhuma questão encontrada para este filtro.</div>`;
    return;
  }

  container.innerHTML = currentQuestions
    .map(
      (q) => `
    <div class="card" id="card-${q.questionId}">
      <div class="question-header">
        <span class="badge">Questão ${q.questionOrder} • ${q.discipline}</span>
        <span style="color: var(--text-muted); font-size: 0.85rem;">${q.topic}</span>
      </div>

      <div class="question-statement">${q.statement.replace(/\n/g, '<br>')}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Figura da questão ${q.questionOrder}">` : ''}
      ${q.imageUrlB ? `<img src="${q.imageUrlB}" class="question-img" alt="Figura complementar">` : ''}

      <div class="options-list" id="opts-${q.questionId}">
        ${q.options
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

let allWrongQuestions = [];
let activeReviewDiscipline = '';

// Carrega as Questões Erradas com Filtro e Contador
async function loadErrorReview() {
  const container = document.getElementById('review-container');
  const counterBadge = document.getElementById('review-counter-badge');

  if (!currentSimulationId) {
    container.innerHTML = `<div class="card" style="text-align: center;">Inicie o simulado oficial antes de revisar.</div>`;
    return;
  }

  container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">Buscando suas questões erradas...</div>`;

  try {
    const wrongList = await window.api.get(`/simulations/review-errors?simulationId=${currentSimulationId}`);
    allWrongQuestions = wrongList || [];

    // Atualiza o contador de erros no banner
    const totalErros = allWrongQuestions.length;
    counterBadge.innerText = totalErros === 1 ? `1 questão errada` : `${totalErros} questões erradas`;

    setupReviewFilters();
    renderFilteredReview();
  } catch (err) {
    container.innerHTML = `<div class="card" style="color: var(--danger); text-align: center;">${err.message || 'Erro ao carregar revisão.'}</div>`;
  }
}

function renderFilteredReview() {
  const container = document.getElementById('review-container');

  // Filtra por matéria se o aluno clicou em alguma disciplina
  const filtered = activeReviewDiscipline
    ? allWrongQuestions.filter((q) => q.discipline === activeReviewDiscipline)
    : allWrongQuestions;

  if (allWrongQuestions.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 2.5rem;">
        <h3 style="color: var(--accent);">🎉 Nenhuma questão pendente para revisão!</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Você não errou nenhuma das questões respondidas até agora.</p>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 2rem;">
        <p style="color: var(--text-muted);">Você não errou nenhuma questão de <strong>${activeReviewDiscipline}</strong>! Parabéns!</p>
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
        <span style="color: #92400e; font-size: 0.85rem;">Segunda Tentativa</span>
      </div>

      <div class="question-statement">${q.statement.replace(/\n/g, '<br>')}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Figura">` : ''}
      ${q.imageUrlB ? `<img src="${q.imageUrlB}" class="question-img" alt="Figura complementar">` : ''}

      <div class="options-list" id="rev-opts-${q.questionId}">
        ${q.options
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

function setupReviewFilters() {
  const buttons = document.querySelectorAll('#review-disciplines-filter .filter-btn');
  buttons.forEach((btn) => {
    btn.onclick = () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeReviewDiscipline = btn.getAttribute('data-discipline');
      renderFilteredReview();
    };
  });
}

// Seleção e Envio no Modo Oficial
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
  btn.innerText = 'Gravando...';
  btn.disabled = true;

  try {
    await window.api.post('/simulations/answer', {
      simulationId: currentSimulationId,
      questionId,
      selectedOptionId,
    });

    btn.innerText = '✓ Resposta Gravada';
    btn.style.background = 'var(--text-muted)';
    btn.style.cursor = 'not-allowed';

    loadSimulation();
  } catch (error) {
    alert(error.message || 'Falha ao gravar resposta.');
    btn.disabled = false;
    btn.innerText = 'Confirmar Resposta';
  }
};

// Seleção e Envio no Modo Revisão Cega
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
  btn.disabled = true;
  btn.innerText = 'Verificando...';

  try {
    const res = await window.api.post('/simulations/answer', {
      simulationId: currentSimulationId,
      questionId,
      selectedOptionId,
    });

    btn.style.display = 'none';
    const feedbackBox = document.getElementById(`rev-feedback-${questionId}`);
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
      btn.style.display = 'inline-flex';
      btn.disabled = false;
      btn.innerText = 'Tentar Outra Alternativa';
    }
  } catch (e) {
    alert(e.message || 'Erro ao verificar revisão.');
    btn.disabled = false;
    btn.innerText = 'Testar Segunda Resposta';
  }
};

function setupFilterButtons() {
  const buttons = document.querySelectorAll('#disciplines-filter .filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiscipline = btn.getAttribute('data-discipline');
      loadSimulation();
    });
  });
}
