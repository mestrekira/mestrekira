import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

const essayText = document.getElementById('essayText');
const feedbackInput = document.getElementById('feedback');
const scoreInput = document.getElementById('score');
const status = document.getElementById('status');


if (!essayId) {
  alert('Redação inválida.');
  window.history.back();
}


async function carregarRedacao() {
  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`);
    if (!response.ok) throw new Error();

    const essay = await response.json();

    essayText.textContent = essay.content;
    feedbackInput.value = essay.feedback || '';
    scoreInput.value = essay.score ?? '';

  } catch {
    status.textContent = 'Erro ao carregar a redação.';
  }
}

/
document.getElementById('saveBtn').addEventListener('click', async () => {
  const feedback = feedbackInput.value.trim();
  const score = Number(scoreInput.value);

  if (score < 0 || score > 1000) {
    alert('A nota deve estar entre 0 e 1000.');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, score })
    });

    if (!response.ok) throw new Error();

    status.textContent = 'Correção salva com sucesso.';

  } catch {
    status.textContent = 'Erro ao salvar a correção.';
  }
});

carregarRedacao();
