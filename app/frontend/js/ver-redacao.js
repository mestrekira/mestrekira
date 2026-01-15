import { API_URL } from './config.js';

const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

if (!essayId) {
  alert('Redação inválida.');
  window.location.href = 'desempenho.html';
  throw new Error('essayId ausente');
}

async function carregar() {
  const res = await fetch(`${API_URL}/essays/${essayId}/with-student`);
  if (!res.ok) {
    alert('Não foi possível carregar a redação.');
    return;
  }

  const e = await res.json();

  document.getElementById('student').textContent = e.studentName || '';
  document.getElementById('total').textContent = e.total ?? e.score ?? 0;
  document.getElementById('enem').textContent = `C1:${e.c1} C2:${e.c2} C3:${e.c3} C4:${e.c4} C5:${e.c5}`;
  document.getElementById('content').textContent = e.content || '';
  document.getElementById('feedback').textContent = e.feedback || 'Sem feedback.';
}

carregar();
