import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const userId = params.get('userId');

const statusEl = document.getElementById('status');
const contentEl = document.getElementById('content');
const feedbackBox = document.getElementById('feedbackBox');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');

async function loadEssay() {
  const res = await fetch(`${API_URL}/essays/by-student?userId=${userId}`);
  const essays = await res.json();

  if (!essays.length) {
    statusEl.textContent = 'Nenhuma redação enviada.';
    return;
  }

  const essay = essays[0];

  statusEl.textContent = essay.status;
  contentEl.textContent = essay.content;

  if (essay.status === 'CORRECTED') {
    feedbackBox.style.display = 'block';
    feedbackEl.textContent = essay.feedback;
    scoreEl.textContent = essay.score;
  }
}

loadEssay();
