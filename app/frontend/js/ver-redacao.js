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
  const v = value === null || value === undefined ? '' : String(value).trim();
  el.textContent = v ? v : fallback;
}

// ✅ separa título (primeira linha não vazia) e corpo (resto)
function splitTitleAndBody(raw) {
  const text = (raw ?? '').replace(/\r\n/g, '\n');
  const trimmed = text.trim();
  if (!trimmed) return { title: '—', body: '' };

  const lines = text.split('\n');

  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '—', body: '' };

  const title = String(lines[firstIdx] || '').trim();

  const bodyLines = lines.slice(firstIdx + 1);

  // remove linhas vazias iniciais do corpo
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) {
    bodyLines.shift();
  }

  const body = bodyLines.join('\n').trimEnd();

  return { title: title || '—', body };
}

// ✅ renderiza: título centralizado + corpo justificado dentro da mesma caixa
function renderEssayFormatted(containerEl, rawContent) {
  if (!containerEl) return;

  const { title, body } = splitTitleAndBody(rawContent);

  containerEl.innerHTML = '';
  containerEl.style.whiteSpace = 'pre-wrap';
  containerEl.style.textAlign = 'justify';
  containerEl.style.lineHeight = '1.6';

  const h = document.createElement('div');
  h.textContent = title;
  h.style.textAlign = 'center';
  h.style.fontWeight = '700';
  h.style.marginBottom = '10px';
  containerEl.appendChild(h);

  const b = document.createElement('div');
  b.textContent = body || '';
  b.style.textAlign = 'justify';
  containerEl.appendChild(b);
}

async function carregar() {
  try {
    const res = await fetch(`${API_URL}/essays/${encodeURIComponent(essayId)}`);
    if (!res.ok) throw new Error();

    const e = await res.json();

    // 🔐 permissão
    if (String(e.studentId) !== String(studentId)) {
      alert('Você não tem permissão para ver esta redação.');
      window.location.href = 'desempenho.html';
      return;
    }

    // tema
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

    // nota total
    const score = e.score !== null && e.score !== undefined ? Number(e.score) : null;
    setText(totalEl, score !== null && !Number.isNaN(score) ? String(score) : 'Ainda não corrigida');

    // enem
    const enemTxt =
      score === null
        ? 'Ainda não corrigida'
        : `C1:${e.c1 ?? '—'} C2:${e.c2 ?? '—'} C3:${e.c3 ?? '—'} C4:${e.c4 ?? '—'} C5:${e.c5 ?? '—'}`;
    setText(enemEl, enemTxt);

    // ✅ redação formatada (título + corpo)
    renderEssayFormatted(contentEl, e.content || '');

    // feedback
    if (feedbackEl) {
      feedbackEl.textContent = e.feedback || 'Aguardando correção do professor.';
      feedbackEl.style.whiteSpace = 'pre-wrap';
      feedbackEl.style.textAlign = 'justify';
      feedbackEl.style.lineHeight = '1.6';
    }
  } catch (err) {
    console.error(err);
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
