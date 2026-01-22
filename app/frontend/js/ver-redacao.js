import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');
const studentId = localStorage.getItem('studentId');

if (!essayId || !studentId || studentId === 'undefined' || studentId === 'null') {
  alert('Acesso inválido.');
  window.location.href = 'desempenho.html';
  throw new Error('essayId/studentId ausente');
}

const taskTitleEl = document.getElementById('taskTitle');
const totalEl = document.getElementById('total');
const enemEl = document.getElementById('enem');
const contentEl = document.getElementById('content');
const feedbackEl = document.getElementById('feedback');
const backBtn = document.getElementById('backBtn');

function setText(el, value, fallback = '—') {
  if (!el) return;
  el.textContent = value === null || value === undefined || value === '' ? fallback : String(value);
}

async function carregar() {
  try {
    // 1) redação (endpoint seguro)
    const res = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}`);
    if (!res.ok) throw new Error();

    const e = await res.json();

    // 🔐 Permissão (igual feedback-aluno.js)
    if (String(e.studentId) !== String(studentId)) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'desempenho.html';
      return;
    }

    // 2) tema (opcional, mas ajuda muito)
    setText(taskTitleEl, '—');
    if (e.taskId) {
      try {
        const resTask = await fetch(`${API_URL}/tasks/${encodeURIComponent(e.taskId)}`);
        if (resTask.ok) {
          const task = await resTask.json();
          setText(taskTitleEl, task?.title || '—');
        }
      } catch {
        // ignora
      }
    }

    // 3) nota
    const score =
      e.score !== null && e.score !== undefined ? Number(e.score) : null;
    setText(totalEl, score, 'Ainda não corrigida');

    // 4) enem
    const enemTxt =
      score === null
        ? 'Ainda não corrigida'
        : `C1:${e.c1 ?? '—'} C2:${e.c2 ?? '—'} C3:${e.c3 ?? '—'} C4:${e.c4 ?? '—'} C5:${e.c5 ?? '—'}`;
    setText(enemEl, enemTxt);

    // 5) texto e feedback
    setText(contentEl, e.content || '');
    setText(feedbackEl, e.feedback || 'Aguardando correção do professor.');
  } catch {
    alert('Não foi possível carregar a redação.');
    window.location.href = 'desempenho.html';
  }
}

if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'desempenho.html';
  });
}

carregar();
