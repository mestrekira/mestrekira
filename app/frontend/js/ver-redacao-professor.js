import { API_URL } from './config.js';

const professorId = localStorage.getItem('professorId');
if (!professorId || professorId === 'undefined' || professorId === 'null') {
  window.location.replace('login-professor.html');
  throw new Error('professorId ausente');
}

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

if (!essayId) {
  alert('Redação inválida.');
  window.location.href = 'professor-salas.html';
  throw new Error('essayId ausente');
}

const studentEl = document.getElementById('student');
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
    // ✅ endpoint "com aluno" (professor)
    const res = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}/with-student`);
    if (!res.ok) throw new Error();

    const e = await res.json();

    setText(studentEl, e.studentName || '');
    setText(totalEl, e.score ?? null, 'Ainda não corrigida');

    const enemTxt =
      e.score === null || e.score === undefined
        ? 'Ainda não corrigida'
        : `C1:${e.c1 ?? '—'} C2:${e.c2 ?? '—'} C3:${e.c3 ?? '—'} C4:${e.c4 ?? '—'} C5:${e.c5 ?? '—'}`;
    setText(enemEl, enemTxt);

    setText(contentEl, e.content || '');
    setText(feedbackEl, e.feedback || 'Sem feedback.');
  } catch {
    alert('Não foi possível carregar a redação.');
    window.location.href = 'professor-salas.html';
  }
}

if (backBtn) {
  backBtn.addEventListener('click', () => window.history.back());
}

carregar();
