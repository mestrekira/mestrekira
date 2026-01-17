import { API_URL } from './config.js';

// 🔹 PARÂÂMETROS
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

// (opcional) se você decidir mostrar competências no HTML depois
const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

// 🔹 CARREGAR FEEDBACK
async function carregarFeedback() {
  try {
    // 1) redação
    const resEssay = await fetch(`${API_URL}/essays/${essayId}`);
    if (!resEssay.ok) throw new Error();

    const essay = await resEssay.json();

    // 🔐 checagem
    if (essay.studentId !== studentId) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'painel-aluno.html';
      return;
    }

    essayContentEl.textContent = essay.content || '';

    // 2) tema (via taskId)
    taskTitleEl.textContent = '—';
    if (essay.taskId) {
      try {
        const resTask = await fetch(`${API_URL}/tasks/${essay.taskId}`);
        if (resTask.ok) {
          const task = await resTask.json();
          taskTitleEl.textContent = task.title || '—';
        }
      } catch {
        // ignora (deixa —)
      }
    }

    // 3) nota
    scoreEl.textContent =
      essay.score !== null && essay.score !== undefined ? String(essay.score) : 'Ainda não corrigida';

    // 4) feedback
    feedbackEl.textContent = essay.feedback || 'Aguardando correção do professor.';

    // 5) competências (se tiver elementos no HTML)
    if (c1El) c1El.textContent = essay.c1 ?? '—';
    if (c2El) c2El.textContent = essay.c2 ?? '—';
    if (c3El) c3El.textContent = essay.c3 ?? '—';
    if (c4El) c4El.textContent = essay.c4 ?? '—';
    if (c5El) c5El.textContent = essay.c5 ?? '—';
  } catch {
    alert('Erro ao carregar feedback.');
    window.location.href = 'painel-aluno.html';
  }
}

// 🔹 VOLTAR
backBtn.addEventListener('click', () => {
  window.location.href = 'painel-aluno.html';
});

carregarFeedback();
