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

function unpackContent(raw) {
  const text = String(raw || '');
  const m = text.match(/^__TITLE__:(.*)\n\n([\s\S]*)$/);
  if (!m) return { title: '', body: text };
  return { title: String(m[1] || '').trim(), body: String(m[2] || '') };
}

function renderEssayFormatted(containerEl, packedContent) {
  if (!containerEl) return;

  const { title, body } = unpackContent(packedContent);

  containerEl.innerHTML = '';
  containerEl.style.whiteSpace = 'pre-wrap';
  containerEl.style.textAlign = 'justify';

  if (title) {
    const h = document.createElement('div');
    h.textContent = title;
    h.style.textAlign = 'center';
    h.style.fontWeight = '700';
    h.style.marginBottom = '10px';
    containerEl.appendChild(h);
  }

  const p = document.createElement('div');
  p.textContent = body || '';
  p.style.textAlign = 'justify';
  containerEl.appendChild(p);
}

async function carregar() {
  try {
    const res = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}`);
    if (!res.ok) throw new Error();

    const e = await res.json();

    if (String(e.studentId) !== String(studentId)) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'desempenho.html';
      return;
    }

    // tema (opcional)
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

    const score = e.score !== null && e.score !== undefined ? Number(e.score) : null;
    setText(totalEl, score, 'Ainda não corrigida');

    const enemTxt =
      score === null
        ? 'Ainda não corrigida'
        : `C1:${e.c1 ?? '—'} C2:${e.c2 ?? '—'} C3:${e.c3 ?? '—'} C4:${e.c4 ?? '—'} C5:${e.c5 ?? '—'}`;
    setText(enemEl, enemTxt);

    // ✅ redação formatada
    renderEssayFormatted(contentEl, e.content || '');

    // ✅ feedback justificado
    if (feedbackEl) {
      feedbackEl.textContent = e.feedback || 'Aguardando correção do professor.';
      feedbackEl.style.whiteSpace = 'pre-wrap';
      feedbackEl.style.textAlign = 'justify';
    }
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
