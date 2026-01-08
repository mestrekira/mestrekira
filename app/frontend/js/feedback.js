import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedbackText');
const status = document.getElementById('status');


if (!essayId) {
  alert('Redação inválida.');
  history.back();
}


async function carregarFeedback() {
  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`);
    if (!response.ok) throw new Error();

    const essay = await response.json();

    scoreEl.textContent = essay.score !== null
      ? `${essay.score} pontos`
      : 'Ainda não corrigida';

    feedbackEl.textContent = essay.feedback || 'Sem feedback disponível no momento.';

  } catch {
    status.textContent = 'Erro ao carregar feedback.';
  }
}

carregarFeedback();
