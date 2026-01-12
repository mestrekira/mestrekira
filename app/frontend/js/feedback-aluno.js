import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

if (!essayId) {
  alert('Redação inválida.');
  window.location.href = 'painel-aluno.html';
}

// ELEMENTOS
const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

// 🔹 CARREGAR FEEDBACK
async function carregarFeedback() {
  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`);
    if (!response.ok) throw new Error();

    const essay = await response.json();

    scoreEl.textContent = essay.score ?? 'Ainda não corrigida';
    feedbackEl.textContent = essay.feedback || 'Aguardando correção do professor.';

  } catch {
    feedbackEl.textContent = 'Erro ao carregar feedback.';
  }
}

// 🔹 VOLTAR
backBtn.addEventListener('click', () => {
  window.location.href = 'painel-aluno.html';
});

// INIT
carregarFeedback();
