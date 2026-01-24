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

function unpackContent(raw) {
  const txt = String(raw || '');
  if (txt.startsWith('__TITLE__:')) {
    const rest = txt.slice('__TITLE__:'.length);
    const i = rest.indexOf('\n\n');
    if (i >= 0) {
      const title = rest.slice(0, i).trim();
      const body = rest.slice(i + 2);
      return { title, body };
    }
  }
  return { title: '', body: txt };
}

async function carregar() {
  const res = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}/with-student`);
  if (!res.ok) {
    alert('Não foi possível carregar a redação.');
    return;
  }

  const e = await res.json();

  document.getElementById('student').textContent = e.studentName || '';
  document.getElementById('total').textContent = e.score ?? 0;
  document.getElementById('enem').textContent = `C1:${e.c1 ?? '—'} C2:${e.c2 ?? '—'} C3:${e.c3 ?? '—'} C4:${e.c4 ?? '—'} C5:${e.c5 ?? '—'}`;

  const parts = unpackContent(e.content || '');
  const titleEl = document.getElementById('essayTitleFmt');
  const bodyEl = document.getElementById('essayBodyFmt');

  if (titleEl) titleEl.textContent = parts.title || '';
  if (bodyEl) bodyEl.textContent = parts.body || '';

  document.getElementById('feedback').textContent = e.feedback || 'Sem feedback.';
}

carregar();
