import { API_URL } from './config.js';

// 🔹 PARÂMETROS
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');
const studentId = localStorage.getItem('studentId');

if (!essayId || !studentId) {
  alert('Acesso inválido.');
  window.location.href = 'painel-aluno.html';
  throw new Error('Parâmetros ausentes');
}

// 🔹 ELEMENTOS
const taskTitleEl = document.getElementById('taskTitle');
const essayContentEl = document.getElementById('essayContent');
const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

// 🔹 CARREGAR FEEDBACK
async function carregarFeedback() {
  try {
    const response = await fetch(`${API_URL}/essays/${essayId}`);
    if (!response.ok) throw new Error();

    const essay = await response.json();

    // 🔐 SEGURANÇA BÁSICA
    if (essay.studentId !== studentId) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'painel-aluno.html';
      return;
    }

    taskTitleEl.textContent = essay.taskTitle || '—';
    essayContentEl.textContent = essay.content;

    scoreEl.textContent =
      essay.score !== null && essay.score !== undefined
        ? essay.score
        : 'Ainda não corrigida';

    feedbackEl.textContent =
      essay.feedback || 'Aguardando correção do professor.';

  } catch {
    alert('Erro ao carregar feedback.');
    window.location.href = 'painel-aluno.html';
  }
}

// 🔹 VOLTAR
backBtn.addEventListener('click', () => {
  window.location.href = 'painel-aluno.html';
});

// 🔹 INIT
carregarFeedback();
