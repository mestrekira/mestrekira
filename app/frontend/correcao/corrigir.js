import { API_URL } from '../js/config.js';

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

if (!essayId) {
  alert('Redação inválida.');
  throw new Error('essayId ausente');
}

const contentEl = document.getElementById('essayContent');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');

// 🔹 CARREGAR REDAÇÃO
async function carregarRedacao() {
  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`);
    if (!response.ok) throw new Error();

    const essay = await response.json();

    contentEl.textContent = essay.content;
    feedbackEl.value = essay.feedback || '';
    scoreEl.value = essay.score ?? '';

  } catch {
    alert('Erro ao carregar redação.');
  }
}

// 🔹 SALVAR CORREÇÃO
saveBtn.addEventListener('click', async () => {
  const feedback = feedbackEl.value.trim();
  const score = Number(scoreEl.value);

  if (!feedback || isNaN(score)) {
    statusEl.textContent = 'Preencha feedback e nota.';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, score }),
    });

    if (!response.ok) throw new Error();

    statusEl.textContent = 'Correção salva com sucesso.';

  } catch {
    statusEl.textContent = 'Erro ao salvar correção.';
  }
});

carregarRedacao();
