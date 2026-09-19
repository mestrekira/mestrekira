import { api } from './api.js';

let currentSimulationId = null;
let currentQuestions = [];
let activeDiscipline = '';

document.addEventListener('DOMContentLoaded', () => {
  loadSimulation();
  setupFilterButtons();
});

async function loadSimulation() {
  try {
    const url = activeDiscipline
      ? `/simulations/current?discipline=${encodeURIComponent(activeDiscipline)}`
      : '/simulations/current';

    const data = await api.get(url);
    if (!data) return;

    currentSimulationId = data.simulationId;
    currentQuestions = data.questions;

    // Atualiza barra de progresso
    document.getElementById('cycle-title').innerText = data.title;
    document.getElementById('progress-text').innerText = `${data.answeredCount} de ${data.totalQuestions} respondidas`;
    
    const percentage = (data.answeredCount / data.totalQuestions) * 100;
    document.getElementById('progress-bar').style.width = `${percentage}%`;

    renderQuestions();
  } catch (error) {
    document.getElementById('questions-container').innerHTML = `
      <div class="card" style="color: var(--danger); text-align: center;">
        ${error.message || 'Erro ao carregar o simulado.'}
      </div>
    `;
  }
}

function renderQuestions() {
  const container = document.getElementById('questions-container');
  if (currentQuestions.length === 0) {
    container.innerHTML = `<div class="card">Nenhuma questão encontrada para este filtro.</div>`;
    return;
  }

  container.innerHTML = currentQuestions.map((q) => `
    <div class="card" id="card-${q.questionId}">
      <div class="question-header">
        <span class="badge">Questão ${q.questionOrder} • ${q.discipline}</span>
        <span>${q.topic}</span>
      </div>

      <div class="question-statement">${q.statement}</div>

      ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Figura da questão ${q.questionOrder}">` : ''}

      <div class="options-list" id="opts-${q.questionId}">
        ${q.options.map((opt) => `
          <div class="option-item ${q.selectedOptionId === opt.id ? 'selected' : ''}" 
               onclick="selectOption('${q.questionId}', '${opt.id}')"
               id="opt-${opt.id}">
            <span class="option-letter">${opt.letter}</span>
            <span class="option-text">${opt.text}</span>
          </div>
        `).join('')}
      </div>

      <button class="btn" id="btn-submit-${q.questionId}" 
              onclick="submitAnswer('${q.questionId}')" 
              ${q.isAnswered ? 'disabled style="background: var(--text-muted);"' : ''}>
        ${q.isAnswered ? '✓ Resposta Gravada' : 'Confirmar Resposta'}
      </button>
    </div>
  `).join('');

  ${q.imageUrl ? `<img src="${q.imageUrl}" class="question-img" alt="Figura da questão ${q.questionOrder}">` : ''}
${q.imageUrlB ? `<img src="${q.imageUrlB}" class="question-img" alt="Figura complementar da questão ${q.questionOrder}">` : ''}
}

// Armazena seleção temporária do clique
window.tempSelections = {};
window.selectOption = (questionId, optionId) => {
  const optsContainer = document.getElementById(`opts-${questionId}`);
  optsContainer.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
  document.getElementById(`opt-${optionId}`).classList.add('selected');
  window.tempSelections[questionId] = optionId;
};

// Envia resposta para o backend
window.submitAnswer = async (questionId) => {
  const selectedOptionId = window.tempSelections[questionId];
  if (!selectedOptionId) {
    alert('Selecione uma alternativa antes de confirmar.');
    return;
  }

  const btn = document.getElementById(`btn-submit-${questionId}`);
  btn.innerText = 'Gravando...';
  btn.disabled = true;

  try {
    const res = await api.post('/simulations/answer', {
      simulationId: currentSimulationId,
      questionId,
      selectedOptionId,
    });

    btn.innerText = '✓ Resposta Gravada';
    btn.style.background = 'var(--text-muted)';
    
    // Atualiza progresso sem recarregar tudo
    loadSimulation();
  } catch (error) {
    alert(error.message || 'Falha ao gravar resposta.');
    btn.disabled = false;
    btn.innerText = 'Confirmar Resposta';
  }
};

function setupFilterButtons() {
  const buttons = document.querySelectorAll('#disciplines-filter .filter-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDiscipline = btn.getAttribute('data-discipline');
      loadSimulation();
    });
  });
}
