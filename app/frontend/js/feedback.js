import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const studentId = params.get('userId');

const essayContent = document.getElementById('essayContent');
const feedbackText = document.getElementById('feedbackText');
const scoreEl = document.getElementById('score');

async function carregarFeedback() {
  try {
    const response = await fetch(
      `${API_URL}/essays/by-student?studentId=${studentId}`
    );

    const essays = await response.json();

    if (!essays.length) {
      essayContent.textContent = 'Nenhuma redação enviada.';
      return;
    }

    const essay = essays[essays.length - 1];

    essayContent.textContent = essay.content;
    feedbackText.textContent = essay.feedback ?? 'Aguardando correção';
    scoreEl.textContent = essay.score ?? '—';

  } catch (error) {
    console.error(error);
  }
}

carregarFeedback();
