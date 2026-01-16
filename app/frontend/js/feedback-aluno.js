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

const c1El = document.getElementById('c1');
const c2El = document.getElementById('c2');
const c3El = document.getElementById('c3');
const c4El = document.getElementById('c4');
const c5El = document.getElementById('c5');

const scoreEl = document.getElementById('score');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

function setText(el, value, fallback = '—') {
  if (!el) return;
  const v = value === null || value === undefined || value === '' ? fallback : value;
  el.textContent = String(v);
}

// 🔹 CARREGAR FEEDBACK
async function carregarFeedback() {
  try {
    // 1) carrega a redação
    const response = await fetch(`${API_URL}/essays/${essayId}`);
    if (!response.ok) throw new Error();

    const essay = await response.json();

    // 🔐 SEGURANÇA BÁSICA
    if (String(essay.studentId) !== String(studentId)) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'painel-aluno.html';
      return;
    }

    // Redação do aluno
    setText(essayContentEl, essay.content, '');

    // 2) buscar tema pelo taskId (se existir)
    setText(taskTitleEl, 'Carregando tema...');
    if (essay.taskId) {
      try {
        const taskRes = await fetch(`${API_URL}/tasks/${essay.taskId}`);
        if (taskRes.ok) {
          const task = await taskRes.json();
          setText(taskTitleEl, task.title, '—');
        } else {
          setText(taskTitleEl, '—');
        }
      } catch {
        setText(taskTitleEl, '—');
      }
    } else {
      setText(taskTitleEl, '—');
    }

    // 3) competências ENEM + total
    const hasCompetencias =
      essay.c1 !== null && essay.c1 !== undefined &&
      essay.c2 !== null && essay.c2 !== undefined &&
      essay.c3 !== null && essay.c3 !== undefined &&
      essay.c4 !== null && essay.c4 !== undefined &&
      essay.c5 !== null && essay.c5 !== undefined;

    if (hasCompetencias) {
      setText(c1El, essay.c1, '—');
      setText(c2El, essay.c2, '—');
      setText(c3El, essay.c3, '—');
      setText(c4El, essay.c4, '—');
      setText(c5El, essay.c5, '—');

      // score pode vir pronto; se não vier, calcula
      const total =
        essay.score !== null && essay.score !== undefined
          ? essay.score
          : Number(essay.c1) + Number(essay.c2) + Number(essay.c3) + Number(essay.c4) + Number(essay.c5);

      setText(scoreEl, total, '—');
    } else {
      // Ainda não corrigido
      setText(c1El, '—');
      setText(c2El, '—');
      setText(c3El, '—');
      setText(c4El, '—');
      setText(c5El, '—');
      setText(scoreEl, 'Ainda não corrigida');
    }

    // Feedback textual
    setText(feedbackEl, essay.feedback || 'Aguardando correção do professor.');

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
