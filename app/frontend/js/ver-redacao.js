// ver-redacao.js (ou página de visualização da redação)
// Refatorado para padrão auth.js:
// - requireStudentSession 1x no topo
// - authFetch trata 401/403
// - notify + readErrorMessage para mensagens consistentes

import { API_URL } from './config.js';
import {
  notify,
  requireStudentSession,
  authFetch,
  readErrorMessage,
} from './auth.js';

// =====================
// PARÂMETROS + GUARD
// =====================
const params = new URLSearchParams(window.location.search);
const essayId = params.get('essayId');

// ✅ sessão do aluno (1x no topo)
const studentId = requireStudentSession({ redirectTo: 'login-aluno.html' });

if (!essayId) {
  notify('error', 'Acesso inválido', 'Não foi possível identificar a redação.');
  window.location.replace('desempenho.html');
  throw new Error('essayId ausente');
}

// =====================
// ELEMENTOS
// =====================
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

// =====================
// Conteúdo: compat com __TITLE__:
// =====================
function splitTitleAndBody(raw) {
  const text = String(raw ?? '').replace(/\r\n/g, '\n');
  const trimmed = text.trim();
  if (!trimmed) return { title: '—', body: '' };

  // ✅ padrão atual do sistema: "__TITLE__:titulo\n\ncorpo"
  const re = /^(?:__TITLE__|_TITLE_|TITLE)\s*:\s*(.*)\n\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    return {
      title: String(m[1] || '').trim() || '—',
      body: String(m[2] || '').trimEnd(),
    };
  }

  // fallback antigo: primeira linha como título
  const lines = text.split('\n');

  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '—', body: '' };

  let title = String(lines[firstIdx] || '').trim();

  // compat: remove "__TITLE__:" se estiver grudado
  if (title.startsWith('__TITLE__:')) {
    title = title.replace(/^__TITLE__:\s*/, '').trim();
  }

  const bodyLines = lines.slice(firstIdx + 1);
  while (bodyLines.length && !String(bodyLines[0] || '').trim()) bodyLines.shift();
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
  containerEl.style.overflowWrap = 'anywhere';
  containerEl.style.wordBreak = 'break-word';

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

// =====================
// Carregamento
// =====================
async function fetchEssay() {
  const res = await authFetch(
    `${API_URL}/essays/${encodeURIComponent(String(essayId))}`,
    {},
    { redirectTo: 'login-aluno.html' }
  );

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `HTTP ${res.status}`));
  }

  return res.json();
}

async function fetchTaskTitle(taskId) {
  if (!taskId) return null;

  try {
    const res = await authFetch(
      `${API_URL}/tasks/${encodeURIComponent(String(taskId))}`,
      {},
      { redirectTo: 'login-aluno.html' }
    );
    if (!res.ok) return null;

    const task = await res.json().catch(() => null);
    return task?.title ? String(task.title) : null;
  } catch {
    return null;
  }
}

async function carregar() {
  try {
    const e = await fetchEssay();

    // 🔐 permissão
    if (String(e?.studentId) !== String(studentId)) {
      notify('error', 'Sem permissão', 'Você não tem permissão para ver esta redação.');
      window.location.replace('desempenho.html');
      return;
    }

    // tema
    setText(taskTitleEl, '—');
    const t = await fetchTaskTitle(e?.taskId);
    if (t) setText(taskTitleEl, t);

    // nota total
    const score = e?.score !== null && e?.score !== undefined ? Number(e.score) : null;
    setText(
      totalEl,
      score !== null && !Number.isNaN(score) ? String(score) : 'Ainda não corrigida'
    );

    // enem
    const enemTxt =
      score === null
        ? 'Ainda não corrigida'
        : `C1:${e?.c1 ?? '—'} C2:${e?.c2 ?? '—'} C3:${e?.c3 ?? '—'} C4:${e?.c4 ?? '—'} C5:${e?.c5 ?? '—'}`;
    setText(enemEl, enemTxt);

    // ✅ redação formatada (título + corpo)
    renderEssayFormatted(contentEl, e?.content || '');

    // feedback
    if (feedbackEl) {
      feedbackEl.textContent = e?.feedback || 'Aguardando correção do professor.';
      feedbackEl.style.whiteSpace = 'pre-wrap';
      feedbackEl.style.textAlign = 'justify';
      feedbackEl.style.lineHeight = '1.6';
      feedbackEl.style.overflowWrap = 'anywhere';
      feedbackEl.style.wordBreak = 'break-word';
    }
  } catch (err) {
    console.error(err);
    notify('error', 'Erro', String(err?.message || 'Não foi possível carregar a redação.'));
    window.location.replace('desempenho.html');
  }
}

if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'desempenho.html';
  });
}

carregar();
